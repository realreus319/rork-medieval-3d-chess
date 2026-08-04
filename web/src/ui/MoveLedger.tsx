import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ScrollText } from "lucide-react";

import { audio } from "../audio/audioManager";
import type { Faction, GameResult, LedgerMove } from "../core/types";
import type { Locale } from "../xiangqi/i18n";

interface MoveLedgerProps {
  locale: Locale;
  moves: LedgerMove[];
  pgn: string;
  result: GameResult | null;
  turn: Faction;
  thinking: boolean;
  playing: boolean;
  onPreview: (move: LedgerMove | null) => void;
}

interface LedgerRow {
  number: number;
  red: LedgerMove | null;
  black: LedgerMove | null;
}

const COPY = {
  "zh-CN": {
    title: "棋谱",
    ply: "手",
    copy: "复制棋谱",
    copied: "已复制",
    empty: "书记官正在等候。\n落子后将自动记录。",
    waiting: "等待落子",
    thinking: "对手正在推演",
    winner: { w: "红方胜", b: "黑方胜" },
  },
  "en-US": {
    title: "Move record",
    ply: "ply",
    copy: "Copy record",
    copied: "Copied",
    empty: "The scribe waits.\nMoves will appear after play begins.",
    waiting: "Awaiting move",
    thinking: "Opponent is thinking",
    winner: { w: "Red wins", b: "Black wins" },
  },
} as const;

export const MoveLedger = memo(function MoveLedger({ locale, moves, pgn, result, turn, thinking, playing, onPreview }: MoveLedgerProps) {
  const copy = COPY[locale];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const [copied, setCopied] = useState(false);
  const [activePly, setActivePly] = useState<number | null>(null);

  const rows = useMemo<LedgerRow[]>(() => {
    const out: LedgerRow[] = [];
    for (const move of moves) {
      const last = out[out.length - 1];
      if (move.color === "w" || !last || last.black !== null) {
        out.push({ number: move.number, red: move.color === "w" ? move : null, black: move.color === "b" ? move : null });
      } else {
        last.black = move;
      }
    }
    return out;
  }, [moves]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !pinnedRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [rows.length, turn]);

  useEffect(() => {
    setActivePly(null);
    onPreview(null);
  }, [moves.length, onPreview]);

  useEffect(() => () => onPreview(null), [onPreview]);

  const copyRecord = useCallback(() => {
    if (!pgn) return;
    audio.blip("press");
    void navigator.clipboard.writeText(pgn).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch((error: unknown) => console.warn("[ui] clipboard refused the record", error));
  }, [pgn]);

  const pick = useCallback((move: LedgerMove) => {
    const next = activePly === move.ply ? null : move.ply;
    setActivePly(next);
    onPreview(next === null ? null : move);
  }, [activePly, onPreview]);

  return (
    <div className="mc-slate mc-goldleaf flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[#8a652233] px-3 py-2.5 pr-12">
        <div className="flex items-center gap-2">
          <ScrollText size={13} className="text-[#a89268]" />
          <p className="mc-display text-[0.58rem] tracking-[0.28em] text-[#a89268]">{copy.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mc-display text-[0.56rem] tracking-[0.16em] text-[#6f6450]">{moves.length} {copy.ply}</span>
          <button type="button" className="mc-ledger-tool" title={copied ? copy.copied : copy.copy} disabled={!pgn} onClick={copyRecord}>
            {copied ? <Check size={12} className="text-[#8fe0a8]" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mc-history mc-ledger flex-1 overflow-y-auto px-2 py-1.5"
        onScroll={() => {
          const element = scrollRef.current;
          if (element) pinnedRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 28;
        }}
        onPointerLeave={() => onPreview(activePly === null ? null : (moves[activePly] ?? null))}
      >
        {rows.length === 0 ? (
          <p className="whitespace-pre-line px-2 py-8 text-center text-xs italic leading-relaxed text-[#7d6f57]">{copy.empty}</p>
        ) : rows.map((row, index) => (
          <div key={row.number} className="mc-ledger-row" style={{ animationDelay: `${Math.min(index, 6) * 18}ms` }}>
            <span className="mc-ledger-no">{row.number}</span>
            <MoveCell move={row.red} active={row.red?.ply === activePly} onPick={pick} onPreview={onPreview} pending={playing && !row.red && turn === "w"} pendingText={thinking ? copy.thinking : copy.waiting} />
            <MoveCell move={row.black} active={row.black?.ply === activePly} onPick={pick} onPreview={onPreview} pending={playing && !row.black && turn === "b"} pendingText={thinking ? copy.thinking : copy.waiting} />
          </div>
        ))}
      </div>

      {result ? (
        <div className="border-t border-[#8a652233] px-3 py-2 text-center">
          <p className="mc-display text-[0.88rem] tracking-[0.18em] text-[#f2dcaa]">
            {result.winner ? copy.winner[result.winner] : "和棋"}
          </p>
        </div>
      ) : null}
    </div>
  );
});

function MoveCell({ move, active, pending, pendingText, onPick, onPreview }: { move: LedgerMove | null; active: boolean; pending: boolean; pendingText: string; onPick: (move: LedgerMove) => void; onPreview: (move: LedgerMove | null) => void }) {
  if (!move) {
    return pending ? <span className="mc-ledger-pending" aria-label={pendingText}><i /><i /><i /></span> : <span />;
  }
  return (
    <button
      type="button"
      className="mc-ledger-move"
      data-active={active || undefined}
      data-side={move.color}
      title={`${move.from} → ${move.to}`}
      onPointerEnter={() => onPreview(move)}
      onFocus={() => onPreview(move)}
      onClick={() => onPick(move)}
    >
      <span>{move.san}</span>
      {move.check ? <span className={move.mate ? "mc-ledger-mate" : "mc-ledger-check"}>{move.mate ? "杀" : "将"}</span> : null}
    </button>
  );
}
