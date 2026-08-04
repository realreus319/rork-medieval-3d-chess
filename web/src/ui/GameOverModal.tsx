import { useState } from "react";
import { Check, Copy, Home, Swords } from "lucide-react";

import type { Faction, GameResult } from "../core/types";
import type { Locale } from "../xiangqi/i18n";
import { Crest } from "./Heraldry";

interface GameOverModalProps {
  locale: Locale;
  result: GameResult;
  record: string;
  playerColor: Faction;
  versusComputer: boolean;
  onRematch: () => void;
  onMenu: () => void;
}

const COPY = {
  "zh-CN": {
    draw: "和棋",
    victory: "胜利",
    defeat: "败北",
    red: "红方获胜",
    black: "黑方获胜",
    reason: "对方无合法着法或主帅已被攻破",
    rematch: "再战一局",
    menu: "返回军帐",
    copy: "复制棋谱",
    copied: "已复制",
    empty: "尚无着法",
  },
  "en-US": {
    draw: "A DRAW",
    victory: "VICTORY",
    defeat: "DEFEAT",
    red: "RED TRIUMPHS",
    black: "BLACK TRIUMPHS",
    reason: "The opposing general has fallen or has no legal move",
    rematch: "Rematch",
    menu: "Main hall",
    copy: "Copy record",
    copied: "Copied",
    empty: "No moves recorded",
  },
} as const;

export function GameOverModal({ locale, result, record, playerColor, versusComputer, onRematch, onMenu }: GameOverModalProps) {
  const copy = COPY[locale];
  const [copied, setCopied] = useState(false);
  const draw = result.winner === null;
  const playerWon = versusComputer && result.winner === playerColor;
  const headline = draw
    ? copy.draw
    : playerWon
      ? copy.victory
      : versusComputer
        ? copy.defeat
        : result.winner === "w"
          ? copy.red
          : copy.black;

  const copyRecord = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(record);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.warn("[ui] clipboard unavailable", error);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-5 backdrop-blur-[3px]">
      <div className="mc-parchment mc-goldleaf mc-rise w-full max-w-md overflow-hidden">
        <div className="px-6 pb-6 pt-7 text-center">
          <div className="flex justify-center gap-3">
            {result.winner ? <Crest faction={result.winner} size={44} active /> : <><Crest faction="w" size={34} /><Crest faction="b" size={34} /></>}
          </div>
          <h2 className="mc-display mt-4 text-3xl font-bold tracking-[0.14em] text-[#43301a]">{headline}</h2>
          <div className="mc-rule mx-auto mt-2 w-40 opacity-70" />
          <p className="mt-2 text-sm italic text-[#6a5334]">{copy.reason}</p>
          <div className="mt-5 max-h-24 overflow-y-auto rounded-sm border border-[#8a652255] bg-[#00000010] p-3 text-left font-mono text-[0.7rem] leading-relaxed text-[#4a3a24]">
            {record || copy.empty}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="mc-btn mc-btn-primary flex items-center justify-center gap-2" onClick={onRematch}><Swords size={15} /> {copy.rematch}</button>
            <button type="button" className="mc-btn flex items-center justify-center gap-2" onClick={onMenu}><Home size={15} /> {copy.menu}</button>
          </div>
          <button type="button" className="mc-btn mt-2 flex w-full items-center justify-center gap-2" onClick={() => void copyRecord()} disabled={!record}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? copy.copied : copy.copy}
          </button>
        </div>
      </div>
    </div>
  );
}
