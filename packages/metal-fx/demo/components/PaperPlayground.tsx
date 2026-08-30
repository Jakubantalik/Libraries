/**
 * Tuning surface for the Paper `liquidMetal` parameters.
 *
 * Every control here writes into one `PresetMode` object that gets pushed
 * straight at the shared renderer via `setSharedPresetMode`. That is global by
 * necessity — all MetalFx instances share a single GL program, so there is no
 * per-instance tuning to offer.
 *
 * The point of the page is judging the material *in situ*: on a pill, on a
 * circle, at 2×, next to a reflection target, in both themes. A full-frame
 * shader preview would look better and tell you less, so there's a raw sheet
 * at the bottom for reference only.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MetalFx,
  PRESETS,
  setSharedPresetMode,
  type PresetMode,
  type PresetName,
} from '../../src';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { CopyButton } from './CopyButton';
import { ArrowUpIcon, SearchIcon18 } from './icons';

const PRESET_NAMES: PresetName[] = ['chromatic', 'silver', 'gold'];

const SHAPES = [
  { value: 0, label: 'none' },
  { value: 1, label: 'circle' },
  { value: 2, label: 'daisy' },
  { value: 3, label: 'diamond' },
  { value: 4, label: 'metaballs' },
];

const FITS = [
  { value: 0, label: 'none' },
  { value: 1, label: 'contain' },
  { value: 2, label: 'cover' },
];

/** [key, label, min, max, step] for every scalar Paper exposes. */
const SLIDERS: Array<[keyof PresetMode, string, number, number, number]> = [
  ['repetition', 'Repetition', 1, 10, 0.1],
  ['softness', 'Softness', 0, 1, 0.01],
  ['shiftRed', 'Shift red', -1, 1, 0.01],
  ['shiftBlue', 'Shift blue', -1, 1, 0.01],
  ['distortion', 'Distortion', 0, 1, 0.01],
  ['contour', 'Contour', 0, 1, 0.01],
  ['angle', 'Angle', 0, 360, 1],
  ['speed', 'Speed', 0, 3, 0.01],
  ['scale', 'Scale', 0.01, 4, 0.01],
  ['rotation', 'Rotation', 0, 360, 1],
  ['offsetX', 'Offset X', -1, 1, 0.01],
  ['offsetY', 'Offset Y', -1, 1, 0.01],
  ['originX', 'Origin X', 0, 1, 0.01],
  ['originY', 'Origin Y', 0, 1, 0.01],
  ['worldWidth', 'World W', 0, 2000, 10],
  ['worldHeight', 'World H', 0, 2000, 10],
  ['shaderOpacity', 'Shader opacity', 0, 1, 0.01],
];

const label = 'text-xs font-normal leading-[14px] text-(--text-muted)';
const chipBase =
  'flex items-center justify-center h-8 px-3 border-none rounded-lg font-[Inter,sans-serif] text-[13px] leading-[14px] cursor-pointer transition-colors duration-150 whitespace-nowrap hover:bg-(--tab-hover-bg) hover:text-(--tab-hover-color)';

function Chip({ active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...props}
      type="button"
      className={cn(
        chipBase,
        active
          ? 'bg-(--tab-active-bg) text-(--tab-active-color) shadow-(--tab-active-shadow)'
          : 'bg-(--tab-bg) text-(--tab-color)'
      )}
    />
  );
}

function Slider({
  name,
  value,
  min,
  max,
  step,
  onChange,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className={cn(label, 'flex justify-between gap-2')}>
        <span>{name}</span>
        <span className="font-[Roboto_Mono,monospace] tabular-nums opacity-80">
          {step < 1 ? value.toFixed(2) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#8ab4ff] cursor-grab active:cursor-grabbing"
      />
    </label>
  );
}

/**
 * `<input type="color">` can't express alpha, but `u_colorTint`'s alpha is the
 * colour-burn *amount* — the single most important control on the page. So
 * hex and alpha are split into a swatch plus its own slider.
 */
function ColorField({
  name,
  hint,
  value,
  onChange,
}: {
  name: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const rgb = value.slice(0, 7);
  const alpha = value.length >= 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
  const setAlpha = (a: number) =>
    onChange(rgb + Math.round(a * 255).toString(16).padStart(2, '0'));

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className={cn(label, 'flex justify-between gap-2')}>
        <span>{name}</span>
        <span className="font-[Roboto_Mono,monospace] tabular-nums opacity-80">{value}</span>
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgb}
          onChange={(e) => onChange(e.target.value + value.slice(7))}
          className="size-8 shrink-0 cursor-pointer rounded-lg border border-(--pill-border) bg-transparent p-0"
          aria-label={`${name} hue`}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={alpha}
          onChange={(e) => setAlpha(Number(e.target.value))}
          className="w-full accent-[#8ab4ff] cursor-grab active:cursor-grabbing"
          aria-label={`${name} amount`}
        />
      </div>
      <span className="text-[11px] leading-[13px] text-(--text-muted) opacity-70">{hint}</span>
    </div>
  );
}

function serialize(p: PresetMode): string {
  const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, ''));
  const lines = [
    `colorBack: '${p.colorBack}',`,
    `colorTint: '${p.colorTint}',`,
    `speed: ${num(p.speed)},`,
    `repetition: ${num(p.repetition)},`,
    `softness: ${num(p.softness)},`,
    `shiftRed: ${num(p.shiftRed)},`,
    `shiftBlue: ${num(p.shiftBlue)},`,
    `distortion: ${num(p.distortion)},`,
    `contour: ${num(p.contour)},`,
    `angle: ${num(p.angle)},`,
    `shape: ${p.shape},`,
    `scale: ${num(p.scale)},`,
    `rotation: ${num(p.rotation)},`,
    `offsetX: ${num(p.offsetX)},`,
    `offsetY: ${num(p.offsetY)},`,
    `originX: ${num(p.originX)},`,
    `originY: ${num(p.originY)},`,
    `worldWidth: ${num(p.worldWidth)},`,
    `worldHeight: ${num(p.worldHeight)},`,
    `fit: ${p.fit},`,
    `shaderOpacity: ${num(p.shaderOpacity)},`,
  ];
  return `{\n  ${lines.join('\n  ')}\n}`;
}

/**
 * Copyable JSX for the arrow button on the stage. Tracks the live toggles so
 * what you copy is what you're looking at — and omits anything sitting at its
 * default, since a snippet full of no-op props teaches the wrong API.
 *
 * `theme` is deliberately absent: the playground pins it to drive the preview,
 * but `'auto'` is the right default in a real app.
 */
function buildArrowUsage(
  preset: PresetName,
  strength: number,
  glow: boolean,
  reflect: boolean
): string {
  const props = [`preset="${preset}"`, 'variant="circle"'];
  if (strength !== 100) props.push(`strength={${(strength / 100).toFixed(2)}}`);
  if (!glow) props.push('disableGlow');
  if (reflect) props.push('reflectionTargets={[autoChipRef]}');
  return [
    `<MetalFx ${props.join(' ')}>`,
    '  <button type="button" aria-label="Send">',
    '    <ArrowUpIcon />',
    '  </button>',
    '</MetalFx>',
  ].join('\n');
}

function CodeBlock({ title, code, note }: { title: string; code: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      <div className="relative flex items-start overflow-hidden rounded-[10px] bg-(--code-bg) py-1.5 pr-10 pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-[Roboto_Mono,monospace] text-[13px] leading-[20px] text-(--code-text)">
          {code}
        </code>
        <CopyButton getText={() => code} />
      </div>
      {note && <span className="text-[11px] text-(--text-muted) opacity-70">{note}</span>}
    </div>
  );
}

const pillBase =
  'h-10 rounded-full border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) cursor-pointer flex items-center justify-center p-0';

export function PaperPlayground() {
  const [theme, toggleTheme] = useTheme();
  const [base, setBase] = useState<PresetName>('chromatic');
  const [params, setParams] = useState<PresetMode>(() => ({ ...PRESETS.chromatic.modes.dark }));
  const [strength, setStrength] = useState(100);
  const [paused, setPaused] = useState(false);
  const [glow, setGlow] = useState(true);
  const [reflect, setReflect] = useState(true);
  const [big, setBig] = useState(false);

  const neighborRef = useRef<HTMLLabelElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  // Every param edit lands here. `setSharedPresetMode` flips presetDirty, so
  // the next animation frame re-uploads — no re-mount, no flash.
  useEffect(() => {
    setSharedPresetMode(params);
    return () => setSharedPresetMode(null);
  }, [params]);

  const loadPreset = (name: PresetName) => {
    setBase(name);
    setParams({ ...PRESETS[name].modes[theme] });
  };

  // Following the theme toggle means the light-mode tuning is reachable
  // without hunting for a second control.
  useEffect(() => {
    setParams({ ...PRESETS[base].modes[theme] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const set = <K extends keyof PresetMode>(k: K, v: PresetMode[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const snippet = useMemo(() => serialize(params), [params]);
  const arrowUsage = useMemo(
    () => buildArrowUsage(base, strength, glow, reflect),
    [base, strength, glow, reflect]
  );
  const reflectionTargets = reflect ? [neighborRef, chipRef] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-10 max-sm:px-4">
      <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-medium text-(--section-title-color)">
            Paper liquid metal — playground
          </h1>
          <p className="mt-1 text-[13px] text-(--text-muted)">
            Paper Shaders <code className="font-[Roboto_Mono,monospace]">liquidMetal</code>, unmodified,
            driving metal-fx's ring + glow + reflection pipeline. Tuning is global — one GL program
            feeds every instance.
          </p>
        </div>
        <div className="flex gap-2">
          <Chip active={false} onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'}</Chip>
          <Chip active={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</Chip>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-lg:grid-cols-1">
        {/* ── Stage ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div
            className="relative flex min-h-[320px] flex-col items-center justify-center gap-8 rounded-[10px] bg-(--surface) p-12 max-sm:p-6"
            style={big ? { zoom: 2 } : undefined}
          >
            <div className="flex items-center gap-3">
              <label
                ref={neighborRef}
                className="relative flex h-10 w-[180px] cursor-text items-center gap-1.5 rounded-full border border-(--pill-border) bg-(--pill-bg) py-2.5 pr-2 pl-3 text-sm font-medium text-(--pill-fg) shadow-(--pill-shadow) [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:fill-none [&_svg]:stroke-[#8B8B8B]"
              >
                <SearchIcon18 />
                <input
                  className="min-w-0 flex-1 border-none bg-transparent text-sm font-medium outline-none placeholder:text-current placeholder:opacity-30"
                  type="search"
                  placeholder="Reflection target"
                  spellCheck={false}
                  tabIndex={-1}
                  aria-label="Reflection target"
                />
              </label>

              <MetalFx
                preset={base}
                theme={theme}
                strength={strength / 100}
                paused={paused}
                disableGlow={!glow}
                reflectionTargets={reflectionTargets}
                scale={big ? 2 : 1}
              >
                <button type="button" className={cn(pillBase, 'w-[140px] text-sm font-medium')}>
                  Upgrade to Pro
                </button>
              </MetalFx>

              <MetalFx
                preset={base}
                variant="circle"
                theme={theme}
                strength={strength / 100}
                paused={paused}
                disableGlow={!glow}
                scale={big ? 2 : 1}
              >
                <button type="button" className={cn(pillBase, 'w-10')} aria-label="Send">
                  <ArrowUpIcon />
                </button>
              </MetalFx>
            </div>

            <div
              ref={chipRef}
              className="flex h-8 items-center rounded-full border border-(--pill-border) bg-(--pill-bg) px-3 text-[13px] text-(--pill-fg) shadow-(--pill-shadow)"
            >
              second reflection target
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={glow} onClick={() => setGlow((g) => !g)}>Glow</Chip>
            <Chip active={reflect} onClick={() => setReflect((r) => !r)}>Reflection</Chip>
            <Chip active={big} onClick={() => setBig((b) => !b)}>2×</Chip>
            <div className="ml-auto flex min-w-[200px] items-center gap-2">
              <span className={label}>Strength</span>
              <input
                type="range"
                min={0}
                max={100}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="w-full accent-[#8ab4ff]"
                aria-label="Strength"
              />
              <span className="w-9 text-right font-[Roboto_Mono,monospace] text-[11px] tabular-nums text-(--text-muted)">
                {strength}%
              </span>
            </div>
          </div>

          <CodeBlock
            title="Usage — arrow button"
            code={arrowUsage}
            note="The circle variant, as used on the send button above."
          />

          <CodeBlock
            title="Preset body"
            code={snippet}
            note="Paste into src/engine/presets.ts as a mode body."
          />
        </div>

        {/* ── Controls ──────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-5 rounded-[10px] bg-(--panel-bg) p-4">
          <div className="flex flex-col gap-2">
            <span className={label}>Load preset</span>
            <div className="flex gap-2">
              {PRESET_NAMES.map((n) => (
                <Chip key={n} active={base === n} onClick={() => loadPreset(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <ColorField
            name="Tint"
            hint="Colour-burn over the fixed silver. Alpha = burn amount."
            value={params.colorTint}
            onChange={(v) => set('colorTint', v)}
          />
          <ColorField
            name="Backdrop"
            hint="Composited under the metal. Keep alpha 0 for ring use."
            value={params.colorBack}
            onChange={(v) => set('colorBack', v)}
          />

          <div className="flex flex-col gap-2">
            <span className={label}>Shape</span>
            <div className="flex flex-wrap gap-1.5">
              {SHAPES.map((s) => (
                <Chip key={s.value} active={params.shape === s.value} onClick={() => set('shape', s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={label}>Fit</span>
            <div className="flex gap-1.5">
              {FITS.map((f) => (
                <Chip key={f.value} active={params.fit === f.value} onClick={() => set('fit', f.value)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {SLIDERS.map(([key, name, min, max, step]) => (
              <Slider
                key={key}
                name={name}
                value={params[key] as number}
                min={min}
                max={max}
                step={step}
                onChange={(v) => set(key, v as PresetMode[typeof key])}
              />
            ))}
          </div>

          <Chip active={false} onClick={() => loadPreset(base)}>Reset to {base}</Chip>
        </aside>
      </div>
    </main>
  );
}
