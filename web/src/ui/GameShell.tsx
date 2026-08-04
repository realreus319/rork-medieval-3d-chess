import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { audio } from "../audio/audioManager";
import type { GameController } from "../core/gameController";
import type { GameSnapshot, LedgerMove } from "../core/types";
import { ARENA_LOOKS, DEFAULT_ARENA, type ArenaTheme } from "../scene/arena";
import { detectQualityPreset, type QualityPreset } from "../scene/quality";
import { SceneEngine, type CameraPreset } from "../scene/sceneEngine";
import { CinematicXiangqiController } from "../xiangqi/cinematicController";
import { UI_COPY, readStoredLocale, storeLocale, type Locale } from "../xiangqi/i18n";
import { GameOverModal } from "./GameOverModal";
import { Hud } from "./Hud";
import { MainMenu, type MatchConfig } from "./MainMenu";
import { SettingsPanel, type GameSettings } from "./SettingsPanel";
import "./medieval.css";

type Phase = "loading" | "menu" | "playing";

const SETTINGS_KEY = "xiangqi.gameshell.settings";

function loadSettings(detected: QualityPreset): GameSettings {
  const fallback: GameSettings = {
    quality: detected,
    arena: DEFAULT_ARENA,
    captureCinematics: true,
    rotateBoard: true,
    rankBadges: true,
    muted: false,
    safeMode: false,
    brightness: 1,
  };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<GameSettings>) : {};
    const forcedSafe = new URLSearchParams(window.location.search).has("safe");
    return {
      ...fallback,
      ...stored,
      quality: stored.quality ?? detected,
      arena: stored.arena ?? DEFAULT_ARENA,
      safeMode: forcedSafe || stored.safeMode === true,
      brightness: typeof stored.brightness === "number" ? Math.min(1.8, Math.max(0.6, stored.brightness)) : 1,
    };
  } catch {
    return fallback;
  }
}

function saveSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in privacy mode; the current session still works.
  }
}

function updateMeta(selector: string, value: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const controller = useMemo(() => new CinematicXiangqiController(), []);
  const detected = useMemo<QualityPreset>(() => detectQualityPreset(), []);
  const initialSettings = useMemo(() => loadSettings(detected), [detected]);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => controller.getSnapshot());
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  const localeRef = useRef<Locale>(locale);
  const [gpu, setGpu] = useState("");
  const [fps, setFps] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cameraFlipped, setCameraFlipped] = useState(false);
  const [tactical, setTactical] = useState(false);
  const [lastConfig, setLastConfig] = useState<MatchConfig>({ mode: "ai", difficulty: 2, humanColor: "red" });

  useEffect(() => controller.on("state", setSnapshot), [controller]);
  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(() => {
    localeRef.current = locale;
    const copy = UI_COPY[locale];
    storeLocale(locale);
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
    updateMeta('meta[name="description"]', copy.description);
    updateMeta('meta[property="og:title"]', copy.documentTitle);
    updateMeta('meta[property="og:description"]', copy.description);
  }, [locale]);

  useEffect(() => {
    const unlock = (): void => { void audio.unlock(); };
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
          onQualityAdjusted: (quality) => {
            setSettings((current) => ({ ...current, quality }));
            setNotice(localeRef.current === "zh-CN" ? `为保持流畅，画质已自动调整为 ${quality}` : `Graphics adjusted to ${quality}`);
            window.setTimeout(() => setNotice(null), 5000);
          },
          onFps: setFps,
          onContextLost: () => setContextLost(true),
          onCameraFlipped: setCameraFlipped,
          onTacticalView: setTactical,
          onRenderFallback: (message, safe) => {
            if (safe) setSettings((current) => ({ ...current, safeMode: true }));
            setNotice(message);
            window.setTimeout(() => setNotice(null), 8000);
          },
        },
        detected,
        DEFAULT_ARENA,
      );
    } catch (error) {
      console.error("[xiangqi-shell] renderer failed", error);
      setUnsupported(true);
      return;
    }

    engineRef.current = engine;
    engine.setInteractive(false);
    engine.setSafeMode(initialSettings.safeMode);
    engine.setBrightness(initialSettings.brightness);
    setGpu(engine.getGpuSummary());
    engine.start();

    void engine.load().then(async () => {
      if (disposed) return;
      setIntroPlaying(true);
      await engine.playIntro();
      if (disposed) return;
      setIntroPlaying(false);
      setPhase("menu");
    }).catch((error) => {
      console.error("[xiangqi-shell] assets failed", error);
      if (!disposed) setUnsupported(true);
    });

    return () => {
      disposed = true;
      engineRef.current = null;
      engine.dispose();
    };
  }, [controller, detected, initialSettings]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setQuality(settings.quality);
    engine.setArena(settings.arena);
    engine.setCaptureCinematics(settings.captureCinematics);
    engine.setRotateBoard(settings.rotateBoard);
    engine.setRankBadges(settings.rankBadges);
    engine.setSafeMode(settings.safeMode);
    engine.setBrightness(settings.brightness);
    audio.setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  const toggleLocale = useCallback(() => {
    setLocale((current) => current === "zh-CN" ? "en-US" : "zh-CN");
  }, []);

  const startMatch = useCallback((config: MatchConfig) => {
    void audio.unlock();
    audio.blip("press");
    setLastConfig(config);
    controller.start(config);
    const engine = engineRef.current;
    engine?.setInteractive(true);
    engine?.setTacticalView(false);
    engine?.setCameraPreset(config.mode === "ai" && config.humanColor === "black" ? "black" : "white");
    setPhase("playing");
  }, [controller]);

  const returnToMenu = useCallback(() => {
    controller.stop();
    const engine = engineRef.current;
    engine?.setTacticalView(false);
    engine?.setInteractive(false);
    engine?.setCameraPreset("cinematic");
    setShowSettings(false);
    setPhase("menu");
  }, [controller]);

  const handleUndo = useCallback(() => {
    if (controller.undo()) {
      audio.blip("press");
      engineRef.current?.resync();
    } else {
      audio.blip("deny");
    }
  }, [controller]);

  const handleResign = useCallback(() => {
    audio.blip("deny");
    controller.resign();
  }, [controller]);

  const handleRematch = useCallback(() => startMatch(lastConfig), [lastConfig, startMatch]);

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch((error) => console.warn("[ui] fullscreen refused", error));
  }, []);

  const handleCamera = useCallback((preset: CameraPreset) => {
    audio.blip("press");
    engineRef.current?.setCameraPreset(preset);
  }, []);

  const handleFlipCamera = useCallback(() => {
    audio.blip("press");
    engineRef.current?.flipCamera();
  }, []);

  const handleToggleTactical = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    audio.blip("press");
    engine.setTacticalView(!engine.isTacticalView());
  }, []);

  const handleArena = useCallback((arena: ArenaTheme) => {
    setSettings((current) => current.arena === arena ? current : { ...current, arena });
  }, []);

  const handlePreviewMove = useCallback((move: LedgerMove | null) => {
    engineRef.current?.previewMove(move ? { from: move.from, to: move.to } : null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setShowSettings(false);
      if (phase !== "playing" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "f" || event.key === "F") handleFlipCamera();
      if (event.key === "t" || event.key === "T") handleToggleTactical();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleFlipCamera, handleToggleTactical, phase]);

  if (unsupported) {
    return (
      <div className="mc-root fixed inset-0 flex items-center justify-center bg-[#05060a] px-6 text-center">
        <div className="mc-slate mc-goldleaf max-w-sm p-6">
          <h2 className="mc-display text-lg text-[#f2e2bd]">{locale === "zh-CN" ? "无法开启 3D 战场" : "The hall needs WebGL"}</h2>
          <p className="mt-2 text-sm text-[#b7a88a]">{locale === "zh-CN" ? "请在浏览器中开启硬件加速后重新加载。" : "Enable hardware acceleration and reload the page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mc-root fixed inset-0 select-none overflow-hidden bg-[#05060a]"
      data-arena={settings.arena}
      style={{ "--mc-vignette": ARENA_LOOKS[settings.arena].screenVignette } as CSSProperties}
    >
      <div className="mc-canvas-wrap"><canvas ref={canvasRef} /></div>
      <div className="mc-vignette" />

      <div className="pointer-events-none absolute inset-0">
        {phase === "loading" ? <LoadingScreen locale={locale} progress={progress} /> : null}

        {phase === "menu" && !introPlaying ? (
          <MainMenu locale={locale} onToggleLocale={toggleLocale} onStart={startMatch} onOpenSettings={() => setShowSettings(true)} />
        ) : null}

        {phase === "playing" ? (
          <Hud
            snapshot={snapshot}
            locale={locale}
            muted={settings.muted}
            fps={fps}
            onNewGame={returnToMenu}
            onUndo={handleUndo}
            onResign={handleResign}
            onToggleSound={() => setSettings((current) => ({ ...current, muted: !current.muted }))}
            onToggleLocale={toggleLocale}
            onFullscreen={handleFullscreen}
            onSettings={() => setShowSettings(true)}
            onCamera={handleCamera}
            onFlipCamera={handleFlipCamera}
            cameraFlipped={cameraFlipped}
            tactical={tactical}
            onToggleTactical={handleToggleTactical}
            arena={settings.arena}
            onArena={handleArena}
            onPreviewMove={handlePreviewMove}
          />
        ) : null}

        {introPlaying ? (
          <button type="button" onClick={() => engineRef.current?.skipIntro()} className="pointer-events-auto absolute inset-0 flex cursor-pointer items-end justify-center bg-transparent pb-10">
            <span className="mc-display mc-pulse text-[0.68rem] tracking-[0.36em] text-[#c8ab74]">{locale === "zh-CN" ? "点击跳过开场" : "CLICK TO SKIP"}</span>
          </button>
        ) : null}

        {showSettings ? (
          <SettingsPanel
            locale={locale}
            settings={settings}
            autoDetected={detected}
            gpu={gpu}
            fps={fps}
            onChange={setSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : null}

        {phase === "playing" && snapshot.status === "over" && snapshot.result ? (
          <GameOverModal
            locale={locale}
            result={snapshot.result}
            record={snapshot.pgn}
            playerColor={snapshot.playerColor}
            versusComputer={snapshot.mode === "ai"}
            onRematch={handleRematch}
            onMenu={returnToMenu}
          />
        ) : null}

        {notice ? <div className="mc-fade mc-slate pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 text-xs text-[#e4d3ac]">{notice}</div> : null}

        {contextLost ? (
          <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-6 text-center">
            <div className="mc-slate mc-goldleaf max-w-sm p-6">
              <h2 className="mc-display text-lg text-[#f2e2bd]">{locale === "zh-CN" ? "战场熄灭了" : "The hall went dark"}</h2>
              <p className="mt-2 text-sm text-[#b7a88a]">{locale === "zh-CN" ? "图形上下文已丢失，请重新加载页面。" : "The graphics context was lost. Reload the page."}</p>
              <button type="button" className="mc-btn mc-btn-primary mt-4 w-full" onClick={() => window.location.reload()}>{locale === "zh-CN" ? "重新加载" : "Reload"}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LoadingScreen({ locale, progress }: { locale: Locale; progress: number }) {
  return (
    <div className="mc-fade absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#05060a]/85 px-6">
      <p className="mc-display text-[0.62rem] tracking-[0.45em] text-[#a89268]">{locale === "zh-CN" ? "正在集结楚汉军阵" : "MUSTERING THE ARMIES"}</p>
      <h1 className="mc-display mc-title-glow text-4xl text-[#f4e3bd]">{locale === "zh-CN" ? "楚汉棋局" : "CHU–HAN XIANGQI"}</h1>
      <div className="h-[3px] w-64 overflow-hidden rounded-full bg-[#2a251c]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#8a6522] via-[#f6dfa5] to-[#8a6522] transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="text-xs italic text-[#7d6f57]">{Math.round(progress * 100)}%</p>
    </div>
  );
}
