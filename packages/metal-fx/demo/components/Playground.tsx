import React, { useRef, useState } from 'react';
import { MetalFx, type MetalFxPreset, type MetalFxVariant } from '../../src';
import type { Theme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { CopyButton } from './CopyButton';
import { ArrowUpIcon, SearchIcon18 } from './icons';
import { PlayPauseToggle } from './PlayPauseToggle';
import { Button } from './ui/button';

const PRESETS: MetalFxPreset[] = ['chromatic', 'silver', 'gold'];
const VARIANTS: MetalFxVariant[] = ['button', 'circle'];

type PlaygroundTab = 'default' | 'shadcn';

function buildSnippet(variant: MetalFxVariant, preset: MetalFxPreset, strength: number, disableGlow: boolean, disableReflection: boolean) {
  const props = [`preset="${preset}"`];
  if (variant !== 'button') props.push(`variant="${variant}"`);
  if (strength !== 1) props.push(`strength={${strength.toFixed(2)}}`);
  if (disableGlow) props.push('disableGlow');
  if (!disableReflection) props.push('reflectionTargets={[siblingRef]}');
  const child = variant === 'circle'
    ? '  <button aria-label="Send"><ArrowUpIcon /></button>'
    : '  <button>Upgrade to Pro</button>';
  return `<MetalFx ${props.join(' ')}>\n${child}\n</MetalFx>`;
}

function buildShadcnSnippet(variant: MetalFxVariant, preset: MetalFxPreset, strength: number, btnVariant: string, disableGlow: boolean, disableReflection: boolean) {
  const props = [`preset="${preset}"`];
  if (variant !== 'button') props.push(`variant="${variant}"`);
  if (strength !== 1) props.push(`strength={${strength.toFixed(2)}}`);
  if (disableGlow) props.push('disableGlow');
  if (!disableReflection) props.push('reflectionTargets={[siblingRef]}');
  const child = variant === 'circle'
    ? `  <Button variant="${btnVariant}" size="icon"><ArrowUpIcon /></Button>`
    : `  <Button variant="${btnVariant}">Click me</Button>`;
  return `<MetalFx ${props.join(' ')}>\n${child}\n</MetalFx>`;
}

const tabBtnBase = 'flex items-center justify-center h-9 px-3 border-none rounded-lg font-[Inter,sans-serif] text-[13px] font-normal leading-[14px] cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap [-webkit-tap-highlight-color:transparent] hover:bg-(--tab-hover-bg) hover:text-(--tab-hover-color) focus-visible:outline-2 focus-visible:outline-[rgba(255,255,255,0.5)] focus-visible:outline-offset-2';

function TabBtn({ active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        tabBtnBase,
        active
          ? 'bg-(--tab-active-bg) text-(--tab-active-color) shadow-(--tab-active-shadow)'
          : 'bg-(--tab-bg) text-(--tab-color)',
      )}
      type="button"
    />
  );
}

const pillBaseClass = 'h-10 rounded-full border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) cursor-pointer flex items-center justify-center p-0';
const demoPillClass = `${pillBaseClass} w-[140px] text-sm font-medium font-inherit leading-[17.938px] tracking-normal whitespace-nowrap`;
const demoCircleClass = `${pillBaseClass} w-10`;
const reflectTargetClass = 'h-10 rounded-full bg-(--pill-bg) border border-(--pill-border) shadow-(--pill-shadow) text-(--pill-fg) text-sm font-medium px-4 flex items-center cursor-default';

export function Playground({
  theme,
  strength,
  onStrengthChange,
}: {
  theme: Theme;
  /** Strength as 0..100, lifted to App so it also drives the hero examples. */
  strength: number;
  onStrengthChange: (value: number) => void;
}) {
  const [tab, setTab] = useState<PlaygroundTab>('default');
  const [variant, setVariant] = useState<MetalFxVariant>('button');
  const [preset, setPreset] = useState<MetalFxPreset>('chromatic');
  // Playground starts paused so the page loads quietly; the PlayPauseToggle
  // below only flips this local state, so the surrounding Examples keep
  // auto-playing regardless.
  const [paused, setPaused] = useState(true);
  const [disableGlow, setDisableGlow] = useState(false);
  const [disableReflection, setDisableReflection] = useState(false);
  const playPauseRef = useRef<HTMLButtonElement>(null);
  const neighborRef = useRef<HTMLLabelElement>(null);

  const snippet = tab === 'default'
    ? buildSnippet(variant, preset, strength / 100, disableGlow, disableReflection)
    : buildShadcnSnippet(variant, preset, strength / 100, 'default', disableGlow, disableReflection);

  const reflectionTargets = disableReflection ? undefined : [playPauseRef, neighborRef];

  return (
    <section className="w-full flex flex-col gap-1.5 mb-12" aria-label="Interactive playground">
      <h2 className="text-base font-normal leading-[34px] text-(--section-title-color)">Playground</h2>

      <div className="flex flex-col gap-4 bg-(--panel-bg) rounded-[10px] p-4">
        <div className="flex items-end gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
          <div className="flex flex-col gap-[9px] min-w-0" role="radiogroup" aria-label="Component style">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Style</span>
            <div className="flex gap-2 items-center">
              <TabBtn active={tab === 'default'} onClick={() => setTab('default')}>Default</TabBtn>
              <TabBtn active={tab === 'shadcn'} onClick={() => setTab('shadcn')}>Shadcn</TabBtn>
            </div>
          </div>

          <div className="flex flex-col gap-[9px] min-w-0" role="radiogroup" aria-label="Component type">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Type</span>
            <div className="flex gap-2 items-center">
              {VARIANTS.map((v) => (
                <TabBtn key={v} active={variant === v} onClick={() => setVariant(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </TabBtn>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[9px] min-w-0" role="radiogroup" aria-label="Color preset">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Color</span>
            <div className="flex gap-2 items-center">
              {PRESETS.map((p) => (
                <TabBtn key={p} active={preset === p} onClick={() => setPreset(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </TabBtn>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[9px] min-w-[100px] w-[140px] max-sm:w-full">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Strength</span>
            <div className="strength-track relative w-full h-9 rounded-lg bg-(--strength-bg) shadow-(--strength-shadow) overflow-hidden cursor-grab active:cursor-grabbing hover:bg-(--strength-hover)">
              <div className="absolute top-0 left-0 bottom-0 rounded-lg bg-(--strength-fill-bg) shadow-(--strength-shadow) transition-[width] duration-[80ms] ease-out pointer-events-none" style={{ width: `${strength}%` }} />
              <span className="absolute top-0 left-[11px] h-full flex items-center text-[11px] font-normal leading-[14px] text-(--text-muted) whitespace-nowrap pointer-events-none z-[1]">{strength}%</span>
              <input
                className="strength-input appearance-none absolute inset-0 w-full h-full m-0 p-0 bg-transparent cursor-grab opacity-0 touch-none z-[2] active:cursor-grabbing"
                type="range"
                min={0}
                max={100}
                step={1}
                value={strength}
                onChange={(e) => onStrengthChange(Number(e.target.value))}
                aria-label="Effect strength"
              />
            </div>
          </div>
        </div>

        <div className="flex items-end gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-4">
          <div className="flex flex-col gap-[9px] min-w-0">
            <span className="text-xs font-normal leading-[14px] text-(--text-muted)">Options</span>
            <div className="flex gap-2 items-center">
              <TabBtn active={disableGlow} onClick={() => setDisableGlow((g) => !g)}>No Glow</TabBtn>
              <TabBtn active={disableReflection} onClick={() => setDisableReflection((r) => !r)}>No Reflection</TabBtn>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full min-h-[304px] rounded-[10px] bg-(--surface) flex flex-col items-center justify-center p-12 gap-6 max-sm:p-6">
        <div className="flex items-center gap-3">
          <label ref={neighborRef} className="relative flex items-center gap-1.5 w-[180px] h-10 rounded-full py-2.5 pr-2 pl-3 bg-(--pill-bg) border border-(--pill-border) shadow-(--pill-shadow) text-(--pill-fg) text-sm font-medium cursor-text [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[#8B8B8B] [&_svg]:fill-none">
            <SearchIcon18 />
            <input className="flex-1 min-w-0 border-none bg-transparent text-sm font-medium font-inherit outline-none text-inherit placeholder:text-current placeholder:opacity-30" type="search" placeholder="Search" spellCheck={false} tabIndex={-1} aria-label="Search" />
          </label>

          {(() => {
            const child = tab === 'default' ? (
              variant === 'circle' ? (
                <button type="button" className={demoCircleClass}>
                  <ArrowUpIcon />
                </button>
              ) : (
                <button type="button" className={demoPillClass}>
                  Upgrade to Pro
                </button>
              )
            ) : (
              variant === 'circle' ? (
                <Button variant="default" size="icon" className="size-10"><ArrowUpIcon /></Button>
              ) : (
                <Button variant="default" className="h-10 w-[140px]">Click me</Button>
              )
            );
            return (
              <MetalFx
                key={`${tab}-${variant}-${preset}`}
                preset={preset}
                variant={tab === 'shadcn' && variant === 'circle' ? 'circle' : variant}
                theme={theme}
                strength={strength / 100}
                paused={paused}
                disableGlow={disableGlow}
                reflectionTargets={reflectionTargets}
              >
                {child}
              </MetalFx>
            );
          })()}
        </div>

        <PlayPauseToggle ref={playPauseRef} playing={!paused} onToggle={() => setPaused((p) => !p)} className="max-sm:absolute max-sm:bottom-6 max-sm:left-1/2 max-sm:-translate-x-1/2" />
      </div>

      <div className="flex items-start h-auto bg-(--code-bg) rounded-[10px] py-1.5 pr-10 pl-3 overflow-hidden relative max-sm:hidden">
        <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">{snippet}</code>
        <CopyButton getText={() => snippet} />
      </div>
    </section>
  );
}
