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
import { XiangqiAiClient } from "./xiangqi/aiClient";
import {
  PIECE_LABELS,
  cloneState,
  createInitialState,
  legalMovesForPiece,
  pieceAt,
  playMove,
  type Color,
  type GameState,
  type Move,
  type PieceType,
  type Position,
} from "./xiangqi/core";
import {
  UI_COPY,
  readStoredLocale,
  storeLocale,
  type Locale,
  type UiCopy,
} from "./xiangqi/i18n";
import { XiangqiScene } from "./xiangqi/scene";

type Mode = "local" | "ai";
type Difficulty = 1 | 2 | 3;

interface LedgerEntry {
  move: Move;
  color: Color;
  type: PieceType;
}

const oppositeColor = (color: Color): Color => (color === "red" ? "black" : "red");

function moveText(entry: LedgerEntry, copy: UiCopy): string {
  const { move, color, type } = entry;
  return `${copy.colorNames[color]} ${copy.pieces[color][type]} ${move.from.col + 1},${move.from.row + 1} → ${move.to.col + 1},${move.to.row + 1}`;
}

function updateMeta(selector: string, value: string): void {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

export default function App() {
  const sceneHost = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<XiangqiScene | null>(null);
  const perspectiveRef = useRef<Color>("red");
  const aiRef = useRef<XiangqiAiClient | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const handleCellRef = useRef<(position: Position) => void>(() => undefined);
  const [state, setState] = useState(stateRef.current);
  const [history, setHistory] = useState<GameState[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [humanColor, setHumanColor] = useState<Color>("red");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [thinking, setThinking] = useState(false);
  const [locale, setLocale] = useState<Locale>(readStoredLocale);

  const copy = UI_COPY[locale];
  const aiColor = oppositeColor(humanColor);

  const legalMoves = useMemo(
    () => (selected ? legalMovesForPiece(state, selected) : []),
    [selected, state],
  );

  const commitMove = useCallback((move: Move) => {
    const current = stateRef.current;
    const next = playMove(current, move);
    if (next === current) return false;
    const actualMove = next.lastMove ?? move;
    const piece = current.pieces.find((item) => item.id === actualMove.pieceId);
    if (!piece) return false;
    setHistory((items) => [...items, cloneState(current)]);
    setLedger((items) => [...items, { move: actualMove, color: piece.color, type: piece.type }]);
    stateRef.current = next;
    setState(next);
    setSelected(null);
    return true;
  }, []);

  const handleCell = useCallback(
    (position: Position) => {
      const current = stateRef.current;
      if (thinking || current.winner || (mode === "ai" && current.turn === aiColor)) return;
      if (selected) {
        const move = legalMovesForPiece(current, selected).find(
          (candidate) => candidate.to.row === position.row && candidate.to.col === position.col,
        );
        if (move && commitMove(move)) return;
      }
      const piece = pieceAt(current, position);
      setSelected(piece?.color === current.turn ? piece.id : null);
    },
    [aiColor, commitMove, mode, selected, thinking],
  );

  handleCellRef.current = handleCell;

  useEffect(() => {
    if (!sceneHost.current) return;
    const scene = new XiangqiScene(sceneHost.current, (position) => handleCellRef.current(position));
    sceneRef.current = scene;
    scene.update(stateRef.current, null, []);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update(state, selected, legalMoves);
  }, [state, selected, legalMoves]);

  useEffect(() => {
    const targetPerspective = mode === "ai" ? humanColor : "red";
    if (perspectiveRef.current !== targetPerspective) {
      sceneRef.current?.flip();
      perspectiveRef.current = targetPerspective;
    }
  }, [humanColor, mode]);

  useEffect(() => {
    aiRef.current = new XiangqiAiClient();
    return () => aiRef.current?.dispose();
  }, []);

  useEffect(() => {
    storeLocale(locale);
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
    updateMeta('meta[name="description"]', copy.description);
    updateMeta('meta[property="og:title"]', copy.documentTitle);
    updateMeta('meta[property="og:description"]', copy.description);
  }, [copy, locale]);

  useEffect(() => {
    if (mode !== "ai" || state.turn !== aiColor || state.winner) return;
    const client = aiRef.current;
    if (!client) return;
    let cancelled = false;
    setThinking(true);
    const timer = window.setTimeout(async () => {
      const move = await client.choose(state, difficulty);
      if (!cancelled && move) commitMove(move);
      if (!cancelled) setThinking(false);
    }, 360);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [aiColor, commitMove, difficulty, mode, state]);

  const reset = useCallback(() => {
    aiRef.current?.cancel();
    const fresh = createInitialState();
    stateRef.current = fresh;
    setState(fresh);
    setSelected(null);
    setHistory([]);
    setLedger([]);
    setThinking(false);
  }, []);

  const undo = useCallback(() => {
    aiRef.current?.cancel();
    setHistory((items) => {
      if (items.length === 0) return items;
      let targetIndex = items.length - 1;
      if (mode === "ai" && stateRef.current.turn === humanColor && items.length >= 2) {
        targetIndex = items.length - 2;
      }
      const previous = cloneState(items[targetIndex]);
      stateRef.current = previous;
      setState(previous);
      setSelected(null);
      setLedger((moves) => moves.slice(0, targetIndex));
      setThinking(false);
      return items.slice(0, targetIndex);
    });
  }, [humanColor, mode]);

  const changeMode = useCallback((nextMode: Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    reset();
  }, [mode, reset]);

  const changeHumanColor = useCallback((color: Color) => {
    if (color === humanColor) return;
    setHumanColor(color);
    reset();
  }, [humanColor, reset]);

  const toggleLocale = useCallback(() => {
    setLocale((current) => (current === "zh-CN" ? "en-US" : "zh-CN"));
  }, []);

  const flipBoard = useCallback(() => {
    sceneRef.current?.flip();
    perspectiveRef.current = oppositeColor(perspectiveRef.current);
  }, []);

  const currentColorName = copy.colorNames[state.turn];
  const status = state.winner
    ? copy.status.winner(copy.colorNames[state.winner])
    : thinking
      ? copy.status.thinking(copy.colorNames[aiColor])
      : state.check
        ? copy.status.checked(currentColorName)
        : copy.status.turn(currentColorName);

  const captured = useMemo(() => {
    const ids = new Set(state.pieces.map((piece) => piece.id));
    return createInitialState().pieces.filter((piece) => !ids.has(piece.id));
  }, [state.pieces]);

  return (
    <main className="app-shell">
      <div className="scene" ref={sceneHost} />
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
          <span>{status}</span>
        </div>
        <div className="toolbar">
          <button
            className="language-toggle"
            onClick={toggleLocale}
            aria-label={copy.switchLanguage}
            title={copy.switchLanguage}
          >
            <Languages size={17} />
            <span>{locale === "zh-CN" ? "EN" : "中"}</span>
          </button>
          <button onClick={undo} disabled={history.length === 0 || thinking} aria-label={copy.toolbar.undo} title={copy.toolbar.undo}>
            <Undo2 size={18} />
          </button>
          <button onClick={flipBoard} aria-label={copy.toolbar.flip} title={copy.toolbar.flip}>
            <FlipVertical2 size={18} />
          </button>
          <button onClick={() => sceneRef.current?.overhead()} aria-label={copy.toolbar.overhead} title={copy.toolbar.overhead}>
            <Camera size={18} />
          </button>
          <button onClick={reset} aria-label={copy.toolbar.restart} title={copy.toolbar.restart}>
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
          <button className={mode === "ai" ? "active" : ""} onClick={() => changeMode("ai")}>
            <Bot size={17} /> {copy.modes.ai}
          </button>
          <button className={mode === "local" ? "active" : ""} onClick={() => changeMode("local")}>
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
                    onClick={() => changeHumanColor(color)}
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
                  <button key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>
                    {copy.difficulties[level]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="rule-note">
          <strong>{copy.rulesTitle}</strong>
          <span>{copy.rulesSummary}</span>
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
