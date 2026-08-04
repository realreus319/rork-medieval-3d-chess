import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Camera,
  Flag,
  Languages,
  LayoutGrid,
  Maximize,
  Repeat,
  RotateCcw,
  ScrollText,
  Settings as SettingsIcon,
  Swords,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import type { GameSnapshot, LedgerMove, PieceKind } from "../core/types";
import { ARENA_ORDER, type ArenaTheme } from "../scene/arena";
import type { CameraPreset } from "../scene/sceneEngine";
import type { Locale } from "../xiangqi/i18n";
import { Crest, pieceGlyph } from "./Heraldry";
import { MoveLedger } from "./MoveLedger";

interface HudProps {
  snapshot: GameSnapshot;
  locale: Locale;
  muted: boolean;
  fps: number;
  onNewGame: () => void;
  onUndo: () => void;
  onResign: () => void;
  onToggleSound: () => void;
  onToggleLocale: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onCamera: (preset: CameraPreset) => void;
  onFlipCamera: () => void;
  cameraFlipped: boolean;
  tactical: boolean;
  onToggleTactical: () => void;
  arena: ArenaTheme;
  onArena: (theme: ArenaTheme) => void;
  onPreviewMove: (move: LedgerMove | null) => void;
}

const COPY = {
  "zh-CN": {
    ended: "对局结束",
    thinking: "正在推演",
    toMove: "当前行棋",
    red: "红方",
    black: "黑方",
    check: "将军",
    undo: "悔棋",
    undoHint: "撤销己方上一手以及电脑应手",
    resign: "认输",
    resignHint: "立即结束本局并判对方获胜",
    newGame: "新对局",
    newGameHint: "返回主菜单重新选择模式",
    soundOn: "声音开启",
    soundOff: "声音关闭",
    fullscreen: "全屏",
    flip: "翻转视角",
    tactical: "俯视棋盘",
    back3d: "返回 3D",
    camera: "镜头与战场",
    settings: "设置",
    ledger: "棋谱",
    losses: "折损",
    even: "子力相当",
    redAhead: "红方领先",
    blackAhead: "黑方领先",
    redLost: "红方损失",
    blackLost: "黑方损失",
    arenas: { dawn: "晨曦", frost: "霜雪", dusk: "暮色", jungle: "日神" },
    cameras: { white: "红方视角", black: "黑方视角", top: "正上方", cinematic: "电影镜头" },
  },
  "en-US": {
    ended: "Battle ended",
    thinking: "Thinking",
    toMove: "To move",
    red: "Red",
    black: "Black",
    check: "CHECK",
    undo: "Take back",
    undoHint: "Undo your last move and the computer reply",
    resign: "Resign",
    resignHint: "Concede the game immediately",
    newGame: "New game",
    newGameHint: "Return to the main menu",
    soundOn: "Sound on",
    soundOff: "Sound off",
    fullscreen: "Fullscreen",
    flip: "Flip sides",
    tactical: "Tactical map",
    back3d: "Back to 3D",
    camera: "Camera & arena",
    settings: "Settings",
    ledger: "Move record",
    losses: "Losses",
    even: "Material even",
    redAhead: "Red ahead",
    blackAhead: "Black ahead",
    redLost: "Red lost",
    blackLost: "Black lost",
    arenas: { dawn: "Dawn", frost: "Frost", dusk: "Dusk", jungle: "Temple" },
    cameras: { white: "Red side", black: "Black side", top: "Overhead", cinematic: "Cinematic" },
  },
} as const;

const CAMERA_BUTTONS: CameraPreset[] = ["white", "black", "top", "cinematic"];

export function Hud({
  snapshot,
  locale,
  muted,
  fps,
  onNewGame,
  onUndo,
  onResign,
  onToggleSound,
  onToggleLocale,
  onFullscreen,
  onSettings,
  onCamera,
  onFlipCamera,
  cameraFlipped,
  tactical,
  onToggleTactical,
  arena,
  onArena,
  onPreviewMove,
}: HudProps) {
  const copy = COPY[locale];
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const chronicleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cameraOpen) return;
    const close = (event: PointerEvent): void => {
      if (cameraRef.current && !cameraRef.current.contains(event.target as Node)) setCameraOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [cameraOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setCameraOpen(false);
        setChronicleOpen(false);
      }
      if ((event.key === "h" || event.key === "H") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setChronicleOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const redLosses = snapshot.captured.filter((piece) => piece.color === "w").map((piece) => piece.kind);
  const blackLosses = snapshot.captured.filter((piece) => piece.color === "b").map((piece) => piece.kind);
  const diff = snapshot.materialDiff;
  const status = snapshot.status === "over"
    ? copy.ended
    : snapshot.thinking
      ? copy.thinking
      : copy.toMove;
  const side = snapshot.turn === "w" ? copy.red : copy.black;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="mc-slate mc-goldleaf pointer-events-auto flex items-center gap-3 px-3 py-2.5">
          <Crest faction={snapshot.turn} size={26} active />
          <div>
            <p className="mc-display text-[0.58rem] tracking-[0.28em] text-[#a89268]">{status}</p>
            <p className="mc-display text-sm text-[#f2e2bd]">{snapshot.status === "over" ? "—" : side}</p>
          </div>
          {snapshot.inCheck && snapshot.status === "playing" ? (
            <span className="mc-danger-flash mc-display rounded-sm border border-[#a8342a] px-2 py-1 text-[0.6rem] tracking-[0.2em] text-[#ff9a8a]">
              {copy.check}
            </span>
          ) : null}
          {snapshot.thinking ? <span className="mc-pulse ml-1 h-2 w-2 rounded-full bg-[#d8b163]" /> : null}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          <IconButton label={copy.undo} hint={copy.undoHint} onClick={onUndo} disabled={!snapshot.canUndo}>
            <RotateCcw size={16} />
          </IconButton>
          <IconButton label={copy.resign} hint={copy.resignHint} onClick={onResign} disabled={snapshot.status !== "playing"} danger>
            <Flag size={16} />
          </IconButton>
          <IconButton label={copy.newGame} hint={copy.newGameHint} onClick={onNewGame}>
            <Swords size={16} />
          </IconButton>
          <IconButton label={muted ? copy.soundOff : copy.soundOn} onClick={onToggleSound}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
          <IconButton label={copy.fullscreen} onClick={onFullscreen}><Maximize size={16} /></IconButton>
          <IconButton label={copy.flip} onClick={onFlipCamera} active={cameraFlipped}><Repeat size={16} /></IconButton>
          <IconButton label={tactical ? copy.back3d : copy.tactical} onClick={onToggleTactical} active={tactical}>
            {tactical ? <Box size={16} /> : <LayoutGrid size={16} />}
          </IconButton>

          <div className="relative" ref={cameraRef}>
            <IconButton label={copy.camera} onClick={() => setCameraOpen((open) => !open)} active={cameraOpen}>
              <Video size={16} />
            </IconButton>
            {cameraOpen ? (
              <div className="mc-slate mc-goldleaf mc-fade absolute right-0 top-[calc(100%+0.5rem)] z-30 w-64 p-3">
                <p className="mc-display mb-2 text-[0.58rem] tracking-[0.26em] text-[#a89268]">{copy.camera}</p>
                <div className="grid grid-cols-2 gap-2">
                  {CAMERA_BUTTONS.map((preset) => (
                    <button key={preset} type="button" className="mc-chip flex items-center justify-center gap-2 py-2" onClick={() => { onCamera(preset); setCameraOpen(false); }}>
                      <Camera size={13} /> {copy.cameras[preset]}
                    </button>
                  ))}
                </div>
                <div className="mc-rule my-3" />
                <div className="grid grid-cols-4 gap-1.5">
                  {ARENA_ORDER.map((theme) => (
                    <button key={theme} type="button" className="mc-arena-card" data-active={arena === theme} onClick={() => onArena(theme)}>
                      <span className="mc-arena-swatch" data-arena={theme} />
                      <span className="text-[0.58rem] text-[#e8d6b1]">{copy.arenas[theme]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <IconButton label={copy.ledger} onClick={() => setChronicleOpen((open) => !open)} active={chronicleOpen}>
            <ScrollText size={16} />
          </IconButton>
          <IconButton label={copy.settings} onClick={onSettings}><SettingsIcon size={16} /></IconButton>
          <IconButton label={locale === "zh-CN" ? "English" : "中文"} onClick={onToggleLocale}><Languages size={16} /></IconButton>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
        <div className="mc-slate mc-goldleaf pointer-events-auto min-w-64 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="mc-display text-[0.6rem] tracking-[0.28em] text-[#a89268]">{copy.losses}</p>
            <span className="mc-display text-[0.68rem] text-[#e2c98f]">
              {diff === 0 ? copy.even : diff > 0 ? `${copy.redAhead} +${Math.round(diff)}` : `${copy.blackAhead} +${Math.round(-diff)}`}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <CapturedRow label={copy.redLost} faction="w" pieces={redLosses} />
            <CapturedRow label={copy.blackLost} faction="b" pieces={blackLosses} />
          </div>
          {fps > 0 ? <p className="mt-2 text-right text-[0.58rem] tracking-wide text-[#6d6149]">{fps} FPS</p> : null}
        </div>
      </div>

      {chronicleOpen ? (
        <div ref={chronicleRef} className="pointer-events-auto absolute bottom-3 right-3 top-20 z-20 w-[min(24rem,calc(100vw-1.5rem))] sm:bottom-4 sm:right-4">
          <button type="button" className="mc-btn mc-icon-btn absolute right-2 top-2 z-10" onClick={() => setChronicleOpen(false)} aria-label="Close">
            <X size={14} />
          </button>
          <MoveLedger
            locale={locale}
            moves={snapshot.moves}
            pgn={snapshot.pgn}
            result={snapshot.result}
            turn={snapshot.turn}
            thinking={snapshot.thinking}
            playing={snapshot.status === "playing"}
            onPreview={onPreviewMove}
          />
        </div>
      ) : null}
    </>
  );
}

function CapturedRow({ label, faction, pieces }: { label: string; faction: "w" | "b"; pieces: PieceKind[] }) {
  return (
    <div className="flex min-h-5 items-center gap-2">
      <Crest faction={faction} size={14} />
      <span className="w-16 text-[0.62rem] text-[#8f7f64]">{label}</span>
      <span className="flex flex-wrap gap-1 text-sm text-[#e4d1aa]">
        {pieces.length === 0 ? <i className="text-[0.62rem] text-[#665c4b]">—</i> : pieces.map((kind, index) => <span key={`${kind}-${index}`}>{pieceGlyph(kind)}</span>)}
      </span>
    </div>
  );
}

function IconButton({ children, label, hint, onClick, disabled, active, danger }: { children: ReactNode; label: string; hint?: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      className="mc-btn mc-icon-btn"
      data-active={active || undefined}
      data-danger={danger || undefined}
      title={hint ? `${label} · ${hint}` : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
