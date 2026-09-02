import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MetalFx,
  PRESETS,
  setSharedPreset,
  type PresetMode,
  type PresetName,
  type PresetTheme,
} from '../../src';
import { ArrowUpIcon } from './icons';

type NumericKey =
  | 'direction'
  | 'speed'
  | 'intensity'
  | 'scale'
  | 'softness'
  | 'distortion'
  | 'complexity'
  | 'shape'
  | 'blur'
  | 'vignette'
  | 'vigOpacity'
  | 'shaderOpacity';

interface SliderSpec {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: 'direction', label: 'Direction (deg)', min: 0, max: 360, step: 1 },
  { key: 'speed', label: 'Speed', min: 0, max: 5, step: 0.05 },
  { key: 'intensity', label: 'Intensity', min: 0, max: 5, step: 0.05 },
  { key: 'scale', label: 'Scale', min: 0.1, max: 5, step: 0.05 },
  { key: 'softness', label: 'Softness', min: 0, max: 1, step: 0.01 },
  { key: 'distortion', label: 'Distortion', min: 0, max: 1, step: 0.01 },
  { key: 'complexity', label: 'Complexity', min: 0, max: 2, step: 0.01 },
  { key: 'shape', label: 'Shape', min: 0, max: 5, step: 1 },
  { key: 'blur', label: 'Blur', min: 0, max: 4, step: 1 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
  { key: 'vigOpacity', label: 'Vignette opacity', min: 0, max: 1, step: 0.01 },
  { key: 'shaderOpacity', label: 'Shader opacity', min: 0, max: 1, step: 0.01 },
];

const PRESET_NAMES: PresetName[] = ['chromatic', 'silver', 'gold'];
const THEMES: PresetTheme[] = ['dark', 'light'];

function deepClonePresets(): Record<PresetName, { dark: PresetMode; light: PresetMode }> {
  return JSON.parse(JSON.stringify({
    chromatic: { dark: PRESETS.chromatic.modes.dark, light: PRESETS.chromatic.modes.light },
    silver: { dark: PRESETS.silver.modes.dark, light: PRESETS.silver.modes.light },
    gold: { dark: PRESETS.gold.modes.dark, light: PRESETS.gold.modes.light },
  }));
}

const ORIGINAL_PRESETS = deepClonePresets();

function presetToTs(name: PresetName, modes: { dark: PresetMode; light: PresetMode }): string {
  const fmtMode = (m: PresetMode) => `    {
      colors: ${JSON.stringify(m.colors)},
      alphas: ${JSON.stringify(m.alphas)},
      direction: ${m.direction},
      speed: ${m.speed},
      intensity: ${m.intensity},
      scale: ${m.scale},
      softness: ${m.softness},
      distortion: ${m.distortion},
      complexity: ${m.complexity},
      shape: ${m.shape},
      blur: ${m.blur},
      vignette: ${m.vignette},
      vigOpacity: ${m.vigOpacity},
      shaderOpacity: ${m.shaderOpacity},
    }`;
  return `const ${name.toUpperCase()}: Preset = {
  name: '${name}',
  modes: {
    dark:
${fmtMode(modes.dark).replace(/^/gm, '')},
    light:
${fmtMode(modes.light).replace(/^/gm, '')},
  },
};`;
}

function presetToJson(name: PresetName, modes: { dark: PresetMode; light: PresetMode }): string {
  return JSON.stringify({ name, modes }, null, 2);
}

const STORAGE_KEY = 'metal-fx-debugger-presets-v1';

function loadFromStorage(): Record<PresetName, { dark: PresetMode; light: PresetMode }> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: Record<PresetName, { dark: PresetMode; light: PresetMode }>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function Debugger() {
  const [activePreset, setActivePreset] = useState<PresetName>('chromatic');
  const [activeTheme, setActiveTheme] = useState<PresetTheme>('dark');
  // Force re-renders when we mutate PRESETS in place.
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  // On mount: hydrate PRESETS from localStorage if present.
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      for (const name of PRESET_NAMES) {
        if (stored[name]) {
          PRESETS[name].modes.dark = stored[name].dark;
          PRESETS[name].modes.light = stored[name].light;
        }
      }
      setSharedPreset(activePreset, activeTheme);
      bump();
    }
    // Apply data-theme to <html> so the existing CSS variable system flips.
    document.documentElement.setAttribute('data-theme', activeTheme);
    return () => {
      document.documentElement.setAttribute('data-theme', 'dark');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever active preset/theme changes, switch the shared renderer + html theme.
  useEffect(() => {
    setSharedPreset(activePreset, activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activePreset, activeTheme]);

  const mode = PRESETS[activePreset].modes[activeTheme];

  const updateColor = (i: number, hex: string) => {
    mode.colors[i] = hex as PresetMode['colors'][number];
    setSharedPreset(activePreset, activeTheme);
    saveToStorage({
      chromatic: PRESETS.chromatic.modes,
      silver: PRESETS.silver.modes,
      gold: PRESETS.gold.modes,
    });
    bump();
  };

  const updateAlpha = (i: number, value: number) => {
    mode.alphas[i] = value as PresetMode['alphas'][number];
    setSharedPreset(activePreset, activeTheme);
    saveToStorage({
      chromatic: PRESETS.chromatic.modes,
      silver: PRESETS.silver.modes,
      gold: PRESETS.gold.modes,
    });
    bump();
  };

  const updateNumeric = (key: NumericKey, value: number) => {
    (mode as any)[key] = value;
    setSharedPreset(activePreset, activeTheme);
    saveToStorage({
      chromatic: PRESETS.chromatic.modes,
      silver: PRESETS.silver.modes,
      gold: PRESETS.gold.modes,
    });
    bump();
  };

  const resetActive = () => {
    PRESETS[activePreset].modes[activeTheme] = JSON.parse(
      JSON.stringify(ORIGINAL_PRESETS[activePreset][activeTheme]),
    );
    setSharedPreset(activePreset, activeTheme);
    saveToStorage({
      chromatic: PRESETS.chromatic.modes,
      silver: PRESETS.silver.modes,
      gold: PRESETS.gold.modes,
    });
    bump();
  };

  const resetAll = () => {
    for (const name of PRESET_NAMES) {
      PRESETS[name].modes.dark = JSON.parse(JSON.stringify(ORIGINAL_PRESETS[name].dark));
      PRESETS[name].modes.light = JSON.parse(JSON.stringify(ORIGINAL_PRESETS[name].light));
    }
    setSharedPreset(activePreset, activeTheme);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    bump();
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const tsSnippet = useMemo(
    () => presetToTs(activePreset, PRESETS[activePreset].modes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePreset, activeTheme, mode.colors.join(','), mode.alphas.join(','), JSON.stringify(mode)],
  );
  const jsonSnippet = useMemo(
    () => presetToJson(activePreset, PRESETS[activePreset].modes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePreset, activeTheme, mode.colors.join(','), mode.alphas.join(','), JSON.stringify(mode)],
  );

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur sticky top-0 z-10">
        <h1 className="text-base font-semibold tracking-tight text-(--text)">metal-fx · preset debugger</h1>
        <a href="/" className="text-xs text-(--text-muted) hover:text-(--text) underline-offset-4 hover:underline">← back to demo</a>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] min-h-0">
        {/* Preview */}
        <div className="flex flex-col items-center justify-center gap-12 p-12 min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <span className="text-xs uppercase tracking-wider text-(--text-muted)">Button</span>
            {/* No `key` here on purpose: MetalFx already re-syncs the shared
                shader via its internal useEffect([preset, theme]). Forcing a
                remount on every preset/theme switch tore down the shared GL
                renderer (instances.size hits 0 in destroyInstance) and the
                fresh instance ended up frozen on a single frame. */}
            <MetalFx
              preset={activePreset}
              variant="button"
              theme={activeTheme}
            >
              <button
                type="button"
                className="w-[200px] h-12 rounded-full border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) text-sm font-medium cursor-pointer"
              >
                Upgrade to Pro
              </button>
            </MetalFx>
          </div>

          <div className="flex flex-col items-center gap-4">
            <span className="text-xs uppercase tracking-wider text-(--text-muted)">Circle</span>
            <MetalFx
              preset={activePreset}
              variant="circle"
              theme={activeTheme}
            >
              <button
                type="button"
                aria-label="Send"
                className="size-12 rounded-full border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) cursor-pointer flex items-center justify-center p-0"
              >
                <ArrowUpIcon />
              </button>
            </MetalFx>
          </div>
        </div>

        {/* Right control panel */}
        <aside className="border-l border-white/10 bg-(--panel-bg) overflow-y-auto p-4 flex flex-col gap-4">
          {/* Preset / Theme tabs */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-(--text-muted)">Preset</span>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_NAMES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActivePreset(p)}
                    className={`h-9 rounded-md text-xs font-medium border transition-colors ${
                      activePreset === p
                        ? 'border-white/30 bg-white/10 text-(--text)'
                        : 'border-white/5 bg-white/5 text-(--text-muted) hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-(--text-muted)">Theme</span>
              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTheme(t)}
                    className={`h-9 rounded-md text-xs font-medium border transition-colors ${
                      activeTheme === t
                        ? 'border-white/30 bg-white/10 text-(--text)'
                        : 'border-white/5 bg-white/5 text-(--text-muted) hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Colors + alphas */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-(--text-muted)">Colors</span>
              <span className="text-[10px] text-(--text-muted)">7 stops · u_color1..7</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {mode.colors.map((c, i) => (
                <div key={i} className="grid grid-cols-[24px_44px_1fr_72px] items-center gap-2">
                  <span className="text-[11px] text-(--text-muted) tabular-nums">{i + 1}</span>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => updateColor(i, e.target.value)}
                    className="h-7 w-11 rounded border-0 bg-transparent cursor-pointer p-0"
                    aria-label={`color stop ${i + 1}`}
                  />
                  <input
                    type="text"
                    value={c}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#([0-9a-fA-F]{6})$/.test(v)) updateColor(i, v.toLowerCase());
                      else bump(); // let user keep typing
                    }}
                    className="h-7 px-2 rounded bg-black/30 border border-white/5 text-(--text) text-xs font-mono outline-none focus:border-white/20"
                    spellCheck={false}
                  />
                  <input
                    type="number"
                    value={mode.alphas[i]}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(e) => updateAlpha(i, Number(e.target.value))}
                    className="h-7 px-2 rounded bg-black/30 border border-white/5 text-(--text) text-xs font-mono outline-none focus:border-white/20"
                    aria-label={`alpha stop ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Numeric sliders */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-(--text-muted)">Parameters</span>
            <div className="flex flex-col gap-2">
              {SLIDERS.map((s) => (
                <NumberSlider
                  key={s.key}
                  spec={s}
                  value={mode[s.key] as number}
                  onChange={(v) => updateNumeric(s.key, v)}
                />
              ))}
            </div>
          </section>

          {/* Actions */}
          <section className="flex flex-col gap-2 sticky bottom-0 bg-(--panel-bg) pt-3 pb-1 -mx-4 px-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => copy(jsonSnippet)}
                className="h-9 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-(--text)"
              >
                Copy JSON (full preset)
              </button>
              <button
                type="button"
                onClick={() => copy(tsSnippet)}
                className="h-9 rounded-md text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-(--text)"
              >
                Copy TS (Preset literal)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={resetActive}
                className="h-9 rounded-md text-xs font-medium border border-white/10 bg-transparent hover:bg-white/5 text-(--text-muted) hover:text-(--text)"
              >
                Reset {activePreset}.{activeTheme}
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="h-9 rounded-md text-xs font-medium border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200"
              >
                Reset ALL
              </button>
            </div>
            <details className="mt-1">
              <summary className="text-[11px] text-(--text-muted) cursor-pointer">Show raw JSON</summary>
              <pre className="mt-2 p-2 rounded bg-black/40 text-[11px] font-mono text-(--text) max-h-48 overflow-auto whitespace-pre">{jsonSnippet}</pre>
            </details>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NumberSlider({
  spec,
  value,
  onChange,
}: {
  spec: SliderSpec;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[1fr_56px] items-center gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-(--text-muted)">{spec.label}</span>
          <span className="text-[10px] font-mono text-(--text-muted)">{value.toFixed(spec.step < 1 ? 2 : 0)}</span>
        </div>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-white"
        />
      </div>
      <input
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 px-2 rounded bg-black/30 border border-white/5 text-(--text) text-xs font-mono outline-none focus:border-white/20"
      />
    </label>
  );
}
