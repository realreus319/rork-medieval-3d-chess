import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Camera,
  FlipVertical2,
  History,
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
  type Position,
} from "./xiangqi/core";
import { XiangqiScene } from "./xiangqi/scene";

type Mode = "local" | "ai";
type Difficulty = 1 | 2 | 3;

function colorName(color: Color) {
  return color === "red" ? "红方" : "黑方";
}

function moveText(state: GameState, move: Move): string {
  const piece = state.pieces.find((item) => item.id === move.pieceId);
  if (!piece) return "未知着法";
  return `${colorName(piece.color)} ${PIECE_LABELS[piece.color][piece.type]} ${move.from.col + 1},${move.from.row + 1} → ${move.to.col + 1},${move.to.row + 1}`;
}

export default function App() {
  const sceneHost = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<XiangqiScene | null>(null);
  const aiRef = useRef<XiangqiAiClient | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const handleCellRef = useRef<(position: Position) => void>(() => undefined);
  const [state, setState] = useState(stateRef.current);
  const [history, setHistory] = useState<GameState[]>([]);
  const [ledger, setLedger] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [thinking, setThinking] = useState(false);

  const legalMoves = useMemo(
    () => (selected ? legalMovesForPiece(state, selected) : []),
    [selected, state],
  );

  const commitMove = useCallback((move: Move) => {
    const current = stateRef.current;
    const next = playMove(current, move);
    if (next === current) return false;
    setHistory((items) => [...items, cloneState(current)]);
    setLedger((items) => [...items, moveText(current, next.lastMove ?? move)]);
    stateRef.current = next;
    setState(next);
    setSelected(null);
    return true;
  }, []);

  const handleCell = useCallback(
    (position: Position) => {
      const current = stateRef.current;
      if (thinking || current.winner || (mode === "ai" && current.turn === "black")) return;
      if (selected) {
        const move = legalMovesForPiece(current, selected).find(
          (candidate) => candidate.to.row === position.row && candidate.to.col === position.col,
        );
        if (move && commitMove(move)) return;
      }
      const piece = pieceAt(current, position);
      setSelected(piece?.color === current.turn ? piece.id : null);
    },
    [commitMove, mode, selected, thinking],
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
    aiRef.current = new XiangqiAiClient();
    return () => aiRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (mode !== "ai" || state.turn !== "black" || state.winner) return;
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
  }, [commitMove, difficulty, mode, state]);

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
      if (mode === "ai" && stateRef.current.turn === "red" && items.length >= 2) targetIndex = items.length - 2;
      const previous = cloneState(items[targetIndex]);
      stateRef.current = previous;
      setState(previous);
      setSelected(null);
      setLedger((moves) => moves.slice(0, targetIndex));
      setThinking(false);
      return items.slice(0, targetIndex);
    });
  }, [mode]);

  const status = state.winner
    ? `${colorName(state.winner)}胜`
    : thinking
      ? "黑方正在推演"
      : state.check
        ? `${colorName(state.turn)}被将军`
        : `${colorName(state.turn)}行棋`;

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
            <strong>楚汉棋局</strong>
            <span>3D XIANGQI</span>
          </div>
        </div>
        <div className={`turn-indicator ${state.turn}`}>
          <Swords size={18} />
          <span>{status}</span>
        </div>
        <div className="toolbar">
          <button onClick={undo} disabled={history.length === 0 || thinking} aria-label="悔棋" title="悔棋">
            <Undo2 size={18} />
          </button>
          <button onClick={() => sceneRef.current?.flip()} aria-label="翻转棋盘" title="翻转棋盘">
            <FlipVertical2 size={18} />
          </button>
          <button onClick={() => sceneRef.current?.overhead()} aria-label="俯视" title="俯视">
            <Camera size={18} />
          </button>
          <button onClick={reset} aria-label="重新开始" title="重新开始">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <aside className="control-panel glass-panel">
        <div className="panel-title">
          <span>对局设置</span>
          <small>第 {Math.ceil(state.moveNumber / 2)} 回合</small>
        </div>
        <div className="mode-switch">
          <button className={mode === "ai" ? "active" : ""} onClick={() => { setMode("ai"); reset(); }}>
            <Bot size={17} /> 人机对弈
          </button>
          <button className={mode === "local" ? "active" : ""} onClick={() => { setMode("local"); reset(); }}>
            <Users size={17} /> 双人对弈
          </button>
        </div>
        {mode === "ai" && (
          <div className="difficulty">
            <span>棋力</span>
            <div>
              {([1, 2, 3] as Difficulty[]).map((level) => (
                <button key={level} className={difficulty === level ? "active" : ""} onClick={() => setDifficulty(level)}>
                  {level === 1 ? "入门" : level === 2 ? "进阶" : "强攻"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="rule-note">
          <strong>完整规则校验</strong>
          <span>蹩马腿 · 塞象眼 · 炮架 · 九宫 · 将帅照面 · 自陷禁手</span>
        </div>
      </aside>

      <aside className="ledger glass-panel">
        <div className="panel-title">
          <span><History size={16} /> 棋谱</span>
          <small>{ledger.length} 手</small>
        </div>
        <div className="move-list">
          {ledger.length === 0 ? (
            <p>落子后自动记录棋谱</p>
          ) : (
            ledger.map((entry, index) => <div key={`${entry}-${index}`}><b>{index + 1}</b><span>{entry}</span></div>)
          )}
        </div>
        <div className="captured-tray">
          <span>已吃棋子</span>
          <div>
            {captured.length === 0 ? <em>暂无</em> : captured.map((piece) => (
              <i key={piece.id} className={piece.color}>{PIECE_LABELS[piece.color][piece.type]}</i>
            ))}
          </div>
        </div>
      </aside>

      <footer className="hint">拖动旋转 · 滚轮缩放 · 点击棋子查看合法落点</footer>

      {state.winner && (
        <div className="game-over">
          <div className="glass-panel">
            <span className={`winner-seal ${state.winner}`}>{state.winner === "red" ? "帅" : "将"}</span>
            <h1>{colorName(state.winner)}获胜</h1>
            <p>残局已定，楚汉再开新局。</p>
            <button onClick={reset}>再战一局</button>
          </div>
        </div>
      )}
    </main>
  );
}
