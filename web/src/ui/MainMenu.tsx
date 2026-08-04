import { useState } from "react";
import { Crown, Languages, Settings as SettingsIcon, Swords, Users } from "lucide-react";

import type { Color } from "../xiangqi/core";
import type { Locale } from "../xiangqi/i18n";
import { Crest } from "./Heraldry";

export interface MatchConfig {
  mode: "ai" | "local";
  difficulty: 1 | 2 | 3;
  humanColor: Color;
}

interface MainMenuProps {
  locale: Locale;
  onToggleLocale: () => void;
  onStart: (config: MatchConfig) => void;
  onOpenSettings: () => void;
}

const COPY = {
  "zh-CN": {
    era: "楚河汉界 · 风云再起",
    title: "楚汉棋局",
    subtitle: "原版电影化 3D 角色演绎的中国象棋",
    ai: "人机对弈",
    local: "双人对弈",
    strength: "对手棋力",
    levels: ["入门", "进阶", "强攻"],
    notes: ["落子较快，适合熟悉规则", "兼顾攻守与搜索深度", "更深搜索，主动制造战术"],
    banner: "选择执方",
    red: "红方 · 先行",
    black: "黑方 · 后行",
    localNote: "两位棋手共用一块棋盘，行棋后镜头可自动转向下一方。",
    start: "列阵开局",
    settings: "画面与游戏设置",
    language: "English",
    hint: "拖动旋转 · 滚轮缩放 · 点击角色查看合法落点",
  },
  "en-US": {
    era: "CHU RIVER · HAN BORDER",
    title: "CHU–HAN XIANGQI",
    subtitle: "Chinese chess staged with the original cinematic 3D cast",
    ai: "Vs computer",
    local: "Two players",
    strength: "Opponent strength",
    levels: ["Beginner", "Advanced", "Aggressive"],
    notes: ["Fast moves for learning the board", "Balanced search and tactics", "Deeper search and active attacks"],
    banner: "Choose your side",
    red: "Red · moves first",
    black: "Black · moves second",
    localNote: "Two commanders share one board. The camera can rotate between turns.",
    start: "Take the field",
    settings: "Graphics & game settings",
    language: "中文",
    hint: "DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A FIGURE TO COMMAND IT",
  },
} as const;

export function MainMenu({ locale, onToggleLocale, onStart, onOpenSettings }: MainMenuProps) {
  const copy = COPY[locale];
  const [mode, setMode] = useState<MatchConfig["mode"]>("ai");
  const [difficulty, setDifficulty] = useState<MatchConfig["difficulty"]>(2);
  const [humanColor, setHumanColor] = useState<Color>("red");

  return (
    <div className="mc-menu pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-5 py-6">
      <button
        type="button"
        className="mc-btn absolute right-5 top-5 flex items-center gap-2"
        onClick={onToggleLocale}
      >
        <Languages size={15} /> {copy.language}
      </button>

      <div className="mc-unfurl mc-menu-hero mb-6 shrink-0 text-center">
        <p className="mc-display text-[0.68rem] tracking-[0.45em] text-[#c8ab74]">{copy.era}</p>
        <h1 className="mc-display mc-title-glow mt-2 text-5xl font-bold text-[#f4e3bd] sm:text-6xl">
          {copy.title}
        </h1>
        <div className="mc-rule mx-auto mt-3 w-64" />
        <p className="mt-3 text-sm italic text-[#c5b28d]">{copy.subtitle}</p>
      </div>

      <div className="mc-slate mc-goldleaf mc-rise flex w-full min-h-0 max-w-md flex-col p-5 sm:p-6">
        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-2 px-2 py-3"
            data-active={mode === "ai"}
            onClick={() => setMode("ai")}
          >
            <Swords size={15} /> {copy.ai}
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-2 px-2 py-3"
            data-active={mode === "local"}
            onClick={() => setMode("local")}
          >
            <Users size={15} /> {copy.local}
          </button>
        </div>

        <div className="mc-scroll -mr-2 min-h-0 flex-auto overflow-y-auto pr-2">
          {mode === "ai" ? (
            <div className="mc-fade space-y-5">
              <div>
                <p className="mc-display mb-2 text-[0.62rem] tracking-[0.28em] text-[#a89268]">{copy.strength}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="mc-chip py-2.5"
                      data-active={difficulty === level}
                      onClick={() => setDifficulty(level)}
                    >
                      {copy.levels[level - 1]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs italic text-[#9c8b6c]">{copy.notes[difficulty - 1]}</p>
              </div>

              <div>
                <p className="mc-display mb-2 text-[0.62rem] tracking-[0.28em] text-[#a89268]">{copy.banner}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["red", "black"] as Color[]).map((color) => {
                    const faction = color === "red" ? "w" : "b";
                    return (
                      <button
                        key={color}
                        type="button"
                        className="mc-chip flex items-center justify-center gap-2 py-2.5"
                        data-active={humanColor === color}
                        onClick={() => setHumanColor(color)}
                      >
                        <Crest faction={faction} size={18} active={humanColor === color} />
                        {color === "red" ? copy.red : copy.black}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="mc-fade text-sm italic leading-relaxed text-[#b7a88a]">{copy.localNote}</p>
          )}
        </div>

        <div className="mc-panel-foot shrink-0">
          <button
            type="button"
            className="mc-btn mc-btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-sm"
            onClick={() => onStart({ mode, difficulty, humanColor })}
          >
            <Crown size={16} /> {copy.start}
          </button>
          <button
            type="button"
            className="mc-btn mt-2 flex w-full items-center justify-center gap-2"
            onClick={onOpenSettings}
          >
            <SettingsIcon size={15} /> {copy.settings}
          </button>
        </div>
      </div>

      <p className="mc-menu-hint mt-5 shrink-0 text-[0.68rem] tracking-[0.18em] text-[#7d6f57]">
        {copy.hint}
      </p>
    </div>
  );
}
