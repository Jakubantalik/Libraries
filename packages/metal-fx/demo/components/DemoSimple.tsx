import React, { useRef, useState } from 'react';
import { MetalFx, type MetalFxPreset } from '../../src';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';
import { ArrowUpIcon, ChevronDownIcon, PlusIcon } from './icons';

const PRESETS: MetalFxPreset[] = ['chromatic', 'gold', 'silver'];

const pillBaseClass =
  'h-10 rounded-[20px] border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) cursor-pointer flex items-center justify-center p-0';
const demoCircleClass = `${pillBaseClass} w-10`;
const chipClass =
  'inline-flex items-center gap-1 h-9 pl-3.5 pr-2.5 rounded-full bg-(--chip-bg) shadow-(--chip-shadow) text-(--chip-color) text-xs leading-[14px] font-inherit cursor-default [&_svg]:size-4 [&_svg]:text-(--chip-icon) [&_svg]:rotate-90';

const tabBtnBase =
  'flex items-center justify-center h-9 px-4 border-none rounded-lg font-[Inter,sans-serif] text-[13px] font-normal leading-[14px] cursor-pointer transition-[background-color,color] duration-150 whitespace-nowrap [-webkit-tap-highlight-color:transparent] hover:bg-(--tab-hover-bg) hover:text-(--tab-hover-color)';

/**
 * Internal "simple" demo:
 *
 *   - A single chat-input mock (the first hero example from the main page),
 *     so we can iterate on that one composition in isolation without the
 *     surrounding marketing chrome (header, install/usage/playground/footer).
 *   - A small tab strip underneath that drives the preset of the up-arrow
 *     circle button: Chromatic, Gold, Silver.
 *   - Tiny theme switcher in the corner so dark + light can be tested
 *     against the same layout.
 *
 * No global state, no slider — strength is fixed at the hero baseline (0.9)
 * to mirror the per-example default that ships in `Examples.tsx`.
 */
export function DemoSimple() {
  const [theme, toggleTheme] = useTheme();
  const [preset, setPreset] = useState<MetalFxPreset>('chromatic');
  // 0..100, mirroring the slider's range. Defaults to 90 to match the
  // hero baseline used everywhere else in the demo.
  const [strength, setStrength] = useState(90);
  const autoChipRef = useRef<HTMLDivElement>(null);

  return (
    <main className="min-h-screen w-full bg-(--page-bg) text-(--text) flex flex-col items-center px-6 pt-6 pb-16 max-sm:px-4">
      <header className="w-full max-w-[835px] flex items-center justify-between mb-6">
        <div className="text-xs font-mono uppercase tracking-wide text-(--text-muted)">
          metal-fx · simple
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 px-3 rounded-md border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) text-xs font-medium cursor-pointer hover:bg-[rgba(255,255,255,0.07)]"
        >
          Theme: {theme}
        </button>
      </header>

      {/* Chat input mock — copied from the first example in Examples.tsx so
          the two pages stay visually identical. (No surface background here;
          the demosimple page lets the chat card sit directly on the page.) */}
      <div className="relative w-full max-w-[835px] h-[314px] flex items-center justify-center px-10 py-12 overflow-hidden max-sm:h-auto max-sm:min-h-[200px] max-sm:px-5 max-sm:py-8">
        <div className="w-[448px] max-w-full rounded-[20px] bg-(--mock-chat-bg) pt-5 px-4 pb-4 flex flex-col max-sm:w-full">
          <textarea
            className="border-none bg-transparent text-(--text) text-sm leading-4 font-inherit outline-none w-full p-0 mb-4 resize-none overflow-hidden placeholder:text-(--mock-chat-placeholder)"
            placeholder="Build anything..."
            rows={1}
            spellCheck={false}
            aria-label="Build anything..."
          />
          <div className="flex items-center gap-3 mt-auto">
            <div className="size-9 min-w-9 rounded-full bg-(--chip-bg) shadow-(--chip-shadow) border-none text-(--chip-color) text-base cursor-default flex items-center justify-center">
              <PlusIcon />
            </div>
            <div className="flex-1" />
            <div className={chipClass}>
              <span>Agent</span>
              <ChevronDownIcon />
            </div>
            <div className={chipClass} ref={autoChipRef}>
              <span>Auto</span>
              <ChevronDownIcon />
            </div>
            <MetalFx
              preset={preset}
              variant="circle"
              theme={theme}
              reflectionTargets={[autoChipRef]}
              strength={strength / 100}
            >
              <button type="button" className={demoCircleClass}>
                <ArrowUpIcon />
              </button>
            </MetalFx>
          </div>
        </div>
      </div>

      {/* Preset tab strip + strength slider on the same row. Outer wrapper
          mirrors the chat-mock's horizontal padding (px-10) so the inner
          448px column lines up exactly with the chat card above. -mt-[46px]
          pulls the row 70px higher than the original mt-6 (24px) spacing. */}
      <div className="-mt-[46px] w-full max-w-[835px] px-10 max-sm:px-5 flex justify-center">
        <div className="w-[448px] max-w-full flex items-center gap-3 flex-wrap justify-end translate-x-[70px] max-sm:translate-x-0">
          <div
            className="flex gap-2 items-center"
            role="radiogroup"
            aria-label="Preset"
          >
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={preset === p}
                onClick={() => setPreset(p)}
                className={cn(
                  tabBtnBase,
                  preset === p
                    ? 'bg-(--tab-active-bg) text-(--tab-active-color) shadow-(--tab-active-shadow)'
                    : 'bg-(--tab-bg) text-(--tab-color)'
                )}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <div className="strength-track relative w-[140px] h-9 rounded-lg bg-(--strength-bg) shadow-(--strength-shadow) overflow-hidden cursor-grab active:cursor-grabbing hover:bg-(--strength-hover)">
            <div
              className="absolute top-0 left-0 bottom-0 rounded-lg bg-(--strength-fill-bg) shadow-(--strength-shadow) transition-[width] duration-[80ms] ease-out pointer-events-none"
              style={{ width: `${strength}%` }}
            />
            <span className="absolute top-0 left-[11px] h-full flex items-center text-[11px] font-normal leading-[14px] text-(--text-muted) whitespace-nowrap pointer-events-none z-[1]">
              {strength}%
            </span>
            <input
              className="strength-input appearance-none absolute inset-0 w-full h-full m-0 p-0 bg-transparent cursor-grab opacity-0 touch-none z-[2] active:cursor-grabbing"
              type="range"
              min={0}
              max={100}
              step={1}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              aria-label="Effect strength"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
