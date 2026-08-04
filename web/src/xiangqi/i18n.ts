import type { Color, PieceType } from "./core";

export type Locale = "zh-CN" | "en-US";
export type DifficultyLevel = 1 | 2 | 3;

export interface UiCopy {
  documentTitle: string;
  description: string;
  brand: string;
  brandSubtitle: string;
  switchLanguage: string;
  colorNames: Record<Color, string>;
  pieces: Record<Color, Record<PieceType, string>>;
  unknownMove: string;
  status: {
    winner: (color: string) => string;
    thinking: (color: string) => string;
    checked: (color: string) => string;
    turn: (color: string) => string;
  };
  toolbar: {
    undo: string;
    flip: string;
    overhead: string;
    restart: string;
  };
  settings: string;
  round: (round: number) => string;
  modes: {
    ai: string;
    local: string;
  };
  chooseSide: string;
  sides: Record<Color, string>;
  difficultyLabel: string;
  difficulties: Record<DifficultyLevel, string>;
  rulesTitle: string;
  rulesSummary: string;
  ledgerTitle: string;
  movesCount: (count: number) => string;
  emptyLedger: string;
  capturedTitle: string;
  none: string;
  hint: string;
  victoryTitle: (color: string) => string;
  victoryDescription: string;
  rematch: string;
}

const zhPieces: UiCopy["pieces"] = {
  red: {
    general: "帅",
    advisor: "仕",
    elephant: "相",
    horse: "马",
    rook: "车",
    cannon: "炮",
    soldier: "兵",
  },
  black: {
    general: "将",
    advisor: "士",
    elephant: "象",
    horse: "马",
    rook: "车",
    cannon: "砲",
    soldier: "卒",
  },
};

const enPieces: UiCopy["pieces"] = {
  red: {
    general: "Marshal",
    advisor: "Advisor",
    elephant: "Elephant",
    horse: "Horse",
    rook: "Chariot",
    cannon: "Cannon",
    soldier: "Soldier",
  },
  black: {
    general: "General",
    advisor: "Advisor",
    elephant: "Elephant",
    horse: "Horse",
    rook: "Chariot",
    cannon: "Cannon",
    soldier: "Pawn",
  },
};

export const UI_COPY: Record<Locale, UiCopy> = {
  "zh-CN": {
    documentTitle: "楚汉棋局｜3D 中国象棋",
    description: "可在浏览器中游玩的 3D 中国象棋，支持人机对弈与本地双人。",
    brand: "楚汉棋局",
    brandSubtitle: "3D 中国象棋",
    switchLanguage: "切换到 English",
    colorNames: { red: "红方", black: "黑方" },
    pieces: zhPieces,
    unknownMove: "未知着法",
    status: {
      winner: (color) => `${color}胜`,
      thinking: (color) => `${color}正在推演`,
      checked: (color) => `${color}被将军`,
      turn: (color) => `${color}行棋`,
    },
    toolbar: {
      undo: "悔棋",
      flip: "翻转棋盘",
      overhead: "俯视棋盘",
      restart: "重新开始",
    },
    settings: "对局设置",
    round: (round) => `第 ${round} 回合`,
    modes: { ai: "人机对弈", local: "双人对弈" },
    chooseSide: "选择执方",
    sides: { red: "执红先行", black: "执黑后行" },
    difficultyLabel: "棋力",
    difficulties: { 1: "入门", 2: "进阶", 3: "强攻" },
    rulesTitle: "完整规则校验",
    rulesSummary: "蹩马腿 · 塞象眼 · 炮架 · 九宫 · 将帅照面 · 自陷禁手",
    ledgerTitle: "棋谱",
    movesCount: (count) => `${count} 手`,
    emptyLedger: "落子后自动记录棋谱",
    capturedTitle: "已吃棋子",
    none: "暂无",
    hint: "拖动旋转 · 滚轮缩放 · 点击棋子查看合法落点",
    victoryTitle: (color) => `${color}获胜`,
    victoryDescription: "残局已定，楚汉再开新局。",
    rematch: "再战一局",
  },
  "en-US": {
    documentTitle: "Chu–Han Xiangqi | 3D Chinese Chess",
    description: "Browser-based 3D Chinese chess with computer and local two-player modes.",
    brand: "Chu–Han Xiangqi",
    brandSubtitle: "3D CHINESE CHESS",
    switchLanguage: "切换到中文",
    colorNames: { red: "Red", black: "Black" },
    pieces: enPieces,
    unknownMove: "Unknown move",
    status: {
      winner: (color) => `${color} wins`,
      thinking: (color) => `${color} is thinking`,
      checked: (color) => `${color} is in check`,
      turn: (color) => `${color} to move`,
    },
    toolbar: {
      undo: "Undo",
      flip: "Flip board",
      overhead: "Overhead view",
      restart: "New game",
    },
    settings: "Game settings",
    round: (round) => `Round ${round}`,
    modes: { ai: "Vs computer", local: "Two players" },
    chooseSide: "Play as",
    sides: { red: "Red · first", black: "Black · second" },
    difficultyLabel: "Strength",
    difficulties: { 1: "Beginner", 2: "Advanced", 3: "Aggressive" },
    rulesTitle: "Full rule validation",
    rulesSummary: "Horse leg · Elephant eye · Cannon screen · Palace · Flying generals · Self-check",
    ledgerTitle: "Move record",
    movesCount: (count) => `${count} moves`,
    emptyLedger: "Moves will appear here after play begins",
    capturedTitle: "Captured pieces",
    none: "None",
    hint: "Drag to orbit · Scroll to zoom · Select a piece to see legal moves",
    victoryTitle: (color) => `${color} wins`,
    victoryDescription: "The battle is settled. Begin another Chu–Han duel.",
    rematch: "Play again",
  },
};

export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_STORAGE_KEY = "xiangqi-locale";

export function resolveLocale(value: string | null | undefined): Locale {
  return value === "en-US" || value === "zh-CN" ? value : DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale {
  try {
    return resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in privacy modes; language still works for this session.
  }
}
