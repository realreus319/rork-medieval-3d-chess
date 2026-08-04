import { X } from "lucide-react";

import { ARENA_LOOKS, ARENA_ORDER, type ArenaTheme } from "../scene/arena";
import type { QualityPreset } from "../scene/quality";
import type { Locale } from "../xiangqi/i18n";

export interface GameSettings {
  quality: QualityPreset;
  arena: ArenaTheme;
  captureCinematics: boolean;
  rotateBoard: boolean;
  rankBadges: boolean;
  muted: boolean;
  safeMode: boolean;
  brightness: number;
}

interface SettingsPanelProps {
  locale: Locale;
  settings: GameSettings;
  autoDetected: QualityPreset;
  gpu: string;
  fps: number;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
}

const COPY = {
  "zh-CN": {
    title: "画面与游戏设置",
    close: "关闭设置",
    battleground: "战场主题",
    arenas: { dawn: "晨曦王庭", frost: "霜雪古堡", dusk: "暮色战场", jungle: "日神遗迹" },
    graphics: "画质",
    quality: {
      low: ["低", "关闭后处理和阴影，适合低性能设备"],
      medium: ["中", "开启辉光、阴影、光束和部分粒子"],
      high: ["高", "增加景深、调色和 2K 阴影"],
      ultra: ["极高", "环境光遮蔽、4K 阴影和高密度粒子"],
    },
    detected: "设备自动识别",
    current: "当前",
    renderer: "渲染器",
    picture: "画面",
    brightness: "亮度",
    safe: "安全渲染",
    safeNote: "黑屏或场景过暗时使用：关闭后处理、反射和阴影",
    cinematic: "吃子电影镜头",
    cinematicNote: "保留攻击、法术、火花、震屏、受击和消散演出",
    rotate: "双人模式自动转镜头",
    rotateNote: "本地双人行棋后，将镜头转向下一方",
    badges: "棋子上方身份徽标",
    badgesNote: "显示帅、仕、相、马、车、炮、兵对应的悬浮标志",
    sound: "声音",
    soundNote: "配乐、环境声、脚步、攻击和死亡音效",
  },
  "en-US": {
    title: "Graphics & game settings",
    close: "Close settings",
    battleground: "Battleground",
    arenas: { dawn: "Dawn Court", frost: "Frost Keep", dusk: "Dusk Siege", jungle: "Sun Temple" },
    graphics: "Graphics",
    quality: {
      low: ["Low", "No post-processing or shadows — runs anywhere"],
      medium: ["Medium", "Bloom, shadows, light shafts and some particles"],
      high: ["High", "Depth of field, grade and 2K shadows"],
      ultra: ["Ultra", "Ambient occlusion, 4K shadows and dense particles"],
    },
    detected: "Auto-detected",
    current: "currently",
    renderer: "Renderer",
    picture: "Picture",
    brightness: "Brightness",
    safe: "Safe rendering",
    safeNote: "For a black or unlit scene — drops effects, reflections and shadows",
    cinematic: "Capture cinematics",
    cinematicNote: "Attack, spell, sparks, shake, death and dissolve sequences",
    rotate: "Rotate between local turns",
    rotateNote: "Swing the camera to the next player in two-player mode",
    badges: "Identity crests above pieces",
    badgesNote: "Show a distinct crest for every Xiangqi role",
    sound: "Sound",
    soundNote: "Music, ambience, footsteps, attacks and death effects",
  },
} as const;

const PRESETS: QualityPreset[] = ["low", "medium", "high", "ultra"];

export function SettingsPanel({ locale, settings, autoDetected, gpu, fps, onChange, onClose }: SettingsPanelProps) {
  const copy = COPY[locale];
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-black/60 px-5 py-6 backdrop-blur-sm">
      <div className="mc-slate mc-goldleaf mc-rise flex max-h-full w-full min-h-0 max-w-lg flex-col p-5 sm:p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="mc-display text-lg text-[#f2e2bd]">{copy.title}</h2>
          <button type="button" className="mc-btn mc-icon-btn" onClick={onClose} aria-label={copy.close}>
            <X size={16} />
          </button>
        </div>

        <div className="mc-scroll mc-scroll-shade -mr-2 min-h-0 flex-auto overflow-y-auto pb-1 pr-2">
          <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">{copy.battleground}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ARENA_ORDER.map((theme) => (
              <button
                key={theme}
                type="button"
                className="mc-arena-card"
                data-active={settings.arena === theme}
                onClick={() => onChange({ ...settings, arena: theme })}
              >
                <span className="mc-arena-swatch" data-arena={theme} />
                <span className="mc-display text-[0.68rem] leading-tight text-[#f0e0be]">{copy.arenas[theme]}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs italic text-[#9c8b6c]">{ARENA_LOOKS[settings.arena].note}</p>

          <div className="mc-rule my-5" />

          <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">{copy.graphics}</p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="mc-chip py-2.5"
                data-active={settings.quality === preset}
                onClick={() => onChange({ ...settings, quality: preset })}
              >
                {copy.quality[preset][0]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs italic text-[#9c8b6c]">{copy.quality[settings.quality][1]}</p>
          <p className="mt-1 text-[0.68rem] text-[#7d6f57]">
            {copy.detected}: <span className="text-[#c8ab74]">{copy.quality[autoDetected][0]}</span>
            {fps > 0 ? ` · ${copy.current} ${fps} FPS` : ""}
          </p>
          {gpu ? <p className="mt-0.5 text-[0.68rem] text-[#6d6149]">{copy.renderer}: {gpu}</p> : null}

          <div className="mc-rule my-5" />

          <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">{copy.picture}</p>
          <div className="flex items-center gap-3 py-1">
            <span className="mc-display w-24 shrink-0 text-[0.72rem] text-[#efe0c0]">{copy.brightness}</span>
            <input
              type="range"
              className="mc-slider flex-auto"
              min={0.6}
              max={1.8}
              step={0.05}
              value={settings.brightness}
              onChange={(event) => onChange({ ...settings, brightness: Number(event.target.value) })}
              aria-label={copy.brightness}
            />
            <span className="w-10 shrink-0 text-right text-xs text-[#c8ab74]">{Math.round(settings.brightness * 100)}%</span>
          </div>

          <Toggle label={copy.safe} note={copy.safeNote} value={settings.safeMode} onChange={(value) => onChange({ ...settings, safeMode: value })} />
          <div className="mc-rule my-5" />
          <Toggle label={copy.cinematic} note={copy.cinematicNote} value={settings.captureCinematics} onChange={(value) => onChange({ ...settings, captureCinematics: value })} />
          <Toggle label={copy.rotate} note={copy.rotateNote} value={settings.rotateBoard} onChange={(value) => onChange({ ...settings, rotateBoard: value })} />
          <Toggle label={copy.badges} note={copy.badgesNote} value={settings.rankBadges} onChange={(value) => onChange({ ...settings, rankBadges: value })} />
          <Toggle label={copy.sound} note={copy.soundNote} value={!settings.muted} onChange={(value) => onChange({ ...settings, muted: !value })} />
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, note, value, onChange }: { label: string; note: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 border-b border-[#8a652222] py-3 text-left last:border-b-0"
      onClick={() => onChange(!value)}
    >
      <span>
        <span className="mc-display block text-[0.78rem] text-[#efe0c0]">{label}</span>
        <span className="text-xs italic text-[#9c8b6c]">{note}</span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200"
        style={{
          background: value ? "linear-gradient(180deg,#d8b163,#8a6522)" : "rgba(20,18,15,0.8)",
          borderColor: value ? "rgba(246,223,165,0.8)" : "rgba(216,177,99,0.3)",
        }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-[#1a1710] transition-all duration-200"
          style={{ left: value ? "1.55rem" : "0.15rem", width: "1.1rem", height: "1.1rem" }}
        />
      </span>
    </button>
  );
}
