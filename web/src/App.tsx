import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Camera,
  FlipVertical2,
  History,
  Languages,
  RotateCcw,
  Swords,
  Undo2,
  Users,
} from "lucide-react";

import { audio } from "./audio/audioManager";
import type { GameController } from "./core/gameController";
import type { GameSnapshot } from "./core/types";
import { DEFAULT_ARENA } from "./scene/arena";
import { detectQualityPreset } from "./scene/quality";
import { SceneEngine } from "./scene/sceneEngine";
import { PIECE_LABELS, createInitialState, type Color, type GameState } from "./xiangqi/core";
import {
  CinematicXiangqiController,
  type CinematicDifficulty,
  type CinematicLedgerEntry,
  type CinematicMode,
} from "./xiangqi/cinematicController";
import { UI_COPY, readStoredLocale, storeLocale, type Locale, type UiCopy } from "./xiangqi/i18n";

type Difficulty = CinematicDifficulty;
type Mode = CinematicMode;

function moveText(entry: CinematicLedgerEntry, copy: UiCopy): string {
  const { move, color, type } = entry;
  return `${copy.colorNames[color]} ${copy.pieces[color][type]} ${move.from.col + 1},${move.from.row + 1} → ${move.to.col + 1},${move.to.row + 1}`;
}

function updateMeta(selector: string, value: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const controller = useMemo(() => new CinematicXiangqiController(), []);
  const quality = useMemo(() => detectQualityPreset(), []);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => controller.getSnapshot());
  const [state, setState] = useState<GameState>(() => controller.getGameState());
  const [ledger, setLedger] = useState<CinematicLedgerEntry[]>(() => controller.getLedger());
  const [mode, setMode] = useState<Mode>("ai");
  const [humanColor, setHumanColor] = useState<Color>("red");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  const localeRef = useRef<Locale>(locale);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const copy = UI_COPY[locale];

  const syncFromController = useCallback(() => {
    setSnapshot(controller.getSnapshot());
    setState(controller.getGameState());
    setLedger(controller.getLedger());
  }, [controller]);

  useEffect(() => controller.on("state", syncFromController), [controller, syncFromController]);

  useEffect(() => {
    localeRef.current = locale;
    storeLocale(locale);
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
    updateMeta('meta[name="description"]', copy.description);
    updateMeta('meta[property="og:title"]', copy.documentTitle);
    updateMeta('meta[property="og:description"]', copy.description);
  }, [copy, locale]);

  useEffect(() => {
    const unlock = () => void audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
      setUnsupported(true);
      return;
    }

    let disposed = false;
    let engine: SceneEngine;
    try {
      engine = new SceneEngine(
        canvas,
        controller as unknown as GameController,
        {
          onLoadProgress: setProgress,
          onReady: () => setProgress(1),
          onPromotionOpen: () => undefined,
          onQualityAdjusted: (preset) => {
            setNotice(localeRef.current === "zh-CN" ? `为保持流畅，画质已调整为 ${preset}` : `Graphics adjusted to ${preset}`);
            window.setTimeout(() => setNotice(null), 4500);
          },
          onFps: () => undefined,
          onContextLost: () => setNotice(localeRef.current === "zh-CN" ? "图形上下文已丢失，请刷新页面" : "Graphics context lost. Reload the page."),
          onCameraFlipped: () => undefined,
          onTacticalView: () => undefined,
          onRenderFallback: (message) => {
            setNotice(message);
            window.setTimeout(() => setNotice(null), 7000);
          },
        },
        quality,
        DEFAULT_ARENA,
      );
    } catch (error) {
      console.error("[xiangqi] could not start cinematic renderer", error);
      setUnsupported(true);
      return;
    }

    engineRef.current = engine;
    engine.setInteractive(false);
    engine.setCaptureCinematics(true);
    engine.setRankBadges(true);
    engine.start();

    void engine.load().then(async () => {
      if (disposed) return;
      await engine.playIntro();
      if (disposed) return;
      engine.setInteractive(true);
      setReady(true);
    }).catch((error) => {
      console.error("[xiangqi] could not load cinematic assets", error);
      if (!disposed) setUnsupported(true);
    });

    return () => {
      disposed = true;
      engineRef.current = null;
      engine.dispose();
    };
  }, [controller, quality]);

  useEffect(() => {
    if (!ready) return;
    controller.start({ mode, difficulty, humanColor });
    engineRef.current?.setCameraPreset(humanColor === "red" ? "white" : "black");
  }, [controller, difficulty, humanColor, mode, ready]);

  useEffect(() => () => controller.dispose(), [controller]);

  const reset = useCallback(() => {
    controller.start({ mode, difficulty, humanColor });
    engineRef.current?.setCameraPreset(humanColor === "red" ? "white" : "black");
  }, [controller, difficulty, humanColor, mode]);

  const undo = useCallback(() => {
    if (controller.undo()) engineRef.current?.resync();
  }, [controller]);

  const toggleLocale = useCallback(() => {
    setLocale((current) => (current === "zh-CN" ? "en-US" : "zh-CN"));
  }, []);

  const currentColorName = copy.colorNames[state.turn];
  const status = state.winner
    ? copy.status.winner(copy.colorNames[state.winner])
    : snapshot.thinking
      ? copy.status.thinking(copy.colorNames[state.turn])
      : state.check
        ? copy.status.checked(currentColorName)
        : copy.status.turn(currentColorName);

  const captured = useMemo(() => {
    const ids = new Set(state.pieces.map((piece) => piece.id));
    return createInitialState().pieces.filter((piece) => !ids.has(piece.id));
  }, [state.pieces]);

  if (unsupported) {
    return (
      <main className="unsupported-screen">
        <div className="glass-panel">
          <h1>{locale === "zh-CN" ? "无法启动 3D 场景" : "3D scene unavailable"}</h1>
          <p>{locale === "zh-CN" ? "当前浏览器或显卡未提供 WebGL，请开启硬件加速后重试。" : "WebGL is unavailable. Enable hardware acceleration and try again."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <canvas className="scene" ref={canvasRef} />
      <div className="vignette" />

      <header className="topbar glass-panel">
        <div className="brand">
          <span className="brand-seal">楚</span>
          <div>
            <strong>{copy.brand}</strong>
            <span>{copy.brandSubtitle}</span>
          </div>
        </div>
        <div className={`turn-indicator ${state.turn}`}>
          <Swords size={18} />
          <span>{ready ? status : locale === "zh-CN" ? "正在集结军阵" : "Assembling the armies"}</span>
        </div>
        <div className="toolbar">
          <button className="language-toggle" onClick={toggleLocale} aria-label={copy.switchLanguage} title={copy.switchLanguage}>
            <Languages size={17} />
            <span>{locale === "zh-CN" ? "EN" : "中"}</span>
          </button>
          <button onClick={undo} disabled={!snapshot.canUndo} aria-label={copy.toolbar.undo} title={copy.toolbar.undo}>
            <Undo2 size={18} />
          </button>
          <button onClick={() => engineRef.current?.flipCamera()} aria-label={copy.toolbar.flip} title={copy.toolbar.flip}>
            <FlipVertical2 size={18} />
          </button>
          <button onClick={() => engineRef.current?.setCameraPreset("top")} aria-label={copy.toolbar.overhead} title={copy.toolbar.overhead}>
            <Camera size={18} />
          </button>
          <button onClick={reset} disabled={!ready} aria-label={copy.toolbar.restart} title={copy.toolbar.restart}>
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <aside className="control-panel glass-panel">
        <div className="panel-title">
          <span>{copy.settings}</span>
          <small>{copy.round(Math.ceil(state.moveNumber / 2))}</small>
        </div>
        <div className="mode-switch">
          <button className={mode === "ai" ? "active" : ""} onClick={() => setMode("ai")} disabled={!ready}>
            <Bot size={17} /> {copy.modes.ai}
          </button>
          <button className={mode === "local" ? "active" : ""} onClick={() => setMode("local")} disabled={!ready}>
            <Users size={17} /> {copy.modes.local}
          </button>
        </div>
        {mode === "ai" && (
          <>
            <div className="side-choice">
              <span>{copy.chooseSide}</span>
              <div>
                {(["red", "black"] as Color[]).map((color) => (
                  <button
                    key={color}
                    className={`${color} ${humanColor === color ? "active" : ""}`}
                    onClick={() => setHumanColor(color)}
                    disabled={!ready}
                  >
                    <b>{color === "red" ? "帅" : "将"}</b>
                    <span>{copy.sides[color]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="difficulty">
              <span>{copy.difficultyLabel}</span>
              <div>
                {([1, 2, 3] as Difficulty[]).map((level) => (
                  <button key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)} disabled={!ready}>
                    {copy.difficulties[level]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="rule-note cinematic-note">
          <strong>{locale === "zh-CN" ? "原版电影化战斗已恢复" : "Original cinematic combat restored"}</strong>
          <span>{locale === "zh-CN" ? "3D 角色 · 行军动画 · 近战攻击 · 远程法术 · 受击死亡 · 消散特效" : "3D characters · marching · melee · spells · death · dissolve effects"}</span>
        </div>
      </aside>

      <aside className="ledger glass-panel">
        <div className="panel-title">
          <span><History size={16} /> {copy.ledgerTitle}</span>
          <small>{copy.movesCount(ledger.length)}</small>
        </div>
        <div className="move-list">
          {ledger.length === 0 ? (
            <p>{copy.emptyLedger}</p>
          ) : (
            ledger.map((entry, index) => (
              <div key={`${entry.move.pieceId}-${index}`}>
                <b>{index + 1}</b>
                <span>{moveText(entry, copy)}</span>
              </div>
            ))
          )}
        </div>
        <div className="captured-tray">
          <span>{copy.capturedTitle}</span>
          <div>
            {captured.length === 0 ? <em>{copy.none}</em> : captured.map((piece) => (
              <i key={piece.id} className={piece.color} title={copy.pieces[piece.color][piece.type]}>
                {PIECE_LABELS[piece.color][piece.type]}
              </i>
            ))}
          </div>
        </div>
      </aside>

      <footer className="hint">{copy.hint}</footer>

      {!ready && (
        <div className="loading-screen">
          <div className="loading-seal">将</div>
          <strong>{locale === "zh-CN" ? "正在加载原版角色与战斗动画" : "Loading original characters and combat animations"}</strong>
          <div className="loading-track"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <small>{Math.round(progress * 100)}%</small>
        </div>
      )}

      {notice && <div className="notice glass-panel">{notice}</div>}

      {state.winner && (
        <div className="game-over">
          <div className="glass-panel">
            <span className={`winner-seal ${state.winner}`}>{state.winner === "red" ? "帅" : "将"}</span>
            <h1>{copy.victoryTitle(copy.colorNames[state.winner])}</h1>
            <p>{copy.victoryDescription}</p>
            <button onClick={reset}>{copy.rematch}</button>
          </div>
        </div>
      )}
    </main>
  );
}
