import React, { useRef } from 'react';
import { MetalFx } from '../../src';
import type { Theme } from '../hooks/useTheme';
import { ArrowUpIcon, ChevronDownIcon, DotsIcon, PlusIcon, SearchIcon18 } from './icons';

const pillBaseClass = 'h-10 rounded-[20px] border border-(--pill-border) bg-(--pill-bg) text-(--pill-fg) shadow-(--pill-shadow) cursor-pointer flex items-center justify-center p-0';
const demoPillClass = `${pillBaseClass} w-[140px] text-sm font-medium font-inherit leading-[17.938px] tracking-normal whitespace-nowrap`;
const demoCircleClass = `${pillBaseClass} w-10`;
const chipClass = 'inline-flex items-center gap-1 h-9 pl-3.5 pr-2.5 rounded-full bg-(--chip-bg) shadow-(--chip-shadow) text-(--chip-color) text-xs leading-[14px] font-inherit cursor-default [&_svg]:size-4 [&_svg]:text-(--chip-icon) [&_svg]:rotate-90';

export function Examples({
  theme,
  scaleFactor = 1,
  strength = 1,
}: {
  theme: Theme;
  /** Forwarded to <MetalFx scale={scaleFactor}/> so that, when these examples
   *  are rendered inside a CSS-zoomed container (Hero2x), the entire metal
   *  effect — shader pattern, ring thickness, glow halo, and reflections —
   *  grows proportionally instead of staying at the 1× pixel size. */
  scaleFactor?: number;
  /** Forwarded to <MetalFx strength={...}/> on every wrapped element so the
   *  Playground's strength slider can drive these hero buttons too. 0..1,
   *  defaults to 1 for the standalone 2x hero where there's no slider. */
  strength?: number;
}) {
  const searchRef = useRef<HTMLLabelElement>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const autoChipRef = useRef<HTMLDivElement>(null);

  return (
    <section className="w-full flex flex-col gap-3 mb-12" aria-label="Effect demonstrations">
      {/* Chat input mock */}
      <div className="relative w-full h-[314px] rounded-[30px] bg-(--surface) flex items-center justify-center px-10 py-12 overflow-hidden max-sm:h-auto max-sm:min-h-[200px] max-sm:px-5 max-sm:py-8 max-sm:rounded-[20px]">
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
            <div className={chipClass}><span>Agent</span><ChevronDownIcon /></div>
            <div className={chipClass} ref={autoChipRef}><span>Auto</span><ChevronDownIcon /></div>
            <MetalFx
              preset="gold"
              variant="circle"
              theme={theme}
              reflectionTargets={[autoChipRef]}
              scale={scaleFactor}
              // Per-example baseline multiplier so the slider still drives
              // the circle, but its rim peaks at 90% rather than full
              // saturation. Pair: chromatic pill below uses 0.7.
              strength={strength * 0.9}
            >
              <button type="button" className={demoCircleClass}>
                <ArrowUpIcon />
              </button>
            </MetalFx>
          </div>
        </div>
      </div>

      {/* Toolbar row */}
      <div className="relative w-full h-[370px] rounded-[30px] bg-(--surface) flex items-center justify-center pl-10 pr-20 py-12 overflow-hidden max-sm:h-auto max-sm:min-h-[200px] max-sm:px-5 max-sm:py-8 max-sm:rounded-[20px]">
        <div className="absolute -left-[22px] top-[144px] w-[663px] h-[234px] rounded-[20px] bg-[rgba(29,29,29,0.7)] border border-[rgba(44,47,54,0.52)] pointer-events-none max-sm:hidden" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3 max-sm:gap-2" role="group" aria-label="Hero toolbar">
          <label className="hero-toolbar-search relative flex items-center gap-1.5 w-[235px] h-10 rounded-full py-2.5 pr-0.5 pl-3 bg-(--pill-bg) border border-(--pill-border) shadow-(--pill-shadow) text-(--pill-fg) text-sm font-medium leading-[17.938px] cursor-text [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[#8B8B8B] [&_svg]:fill-none max-sm:w-auto max-sm:flex-1 max-sm:min-w-0" ref={searchRef}>
            <SearchIcon18 />
            <input
              className="hero-toolbar-search-input flex-1 min-w-0 border-none bg-transparent text-sm font-medium leading-[17.938px] font-inherit outline-none text-inherit placeholder:text-current placeholder:opacity-30"
              type="search"
              placeholder="Search"
              spellCheck={false}
              aria-label="Search"
            />
          </label>

          <MetalFx
            preset="chromatic"
            theme={theme}
            reflectionTargets={[searchRef, dotsRef]}
            scale={scaleFactor}
            // The chromatic pill reads more elegant when its rim is toned
            // down a bit relative to the gold circle above. Scale the global
            // strength by 0.7 so the slider still drives it (max ≈ 70%).
            strength={strength * 0.7}
          >
            <button type="button" className={demoPillClass}>Upgrade to Pro</button>
          </MetalFx>

          <button className="relative inline-flex items-center justify-center size-10 border border-(--pill-border) rounded-full bg-(--pill-bg) shadow-(--pill-shadow) text-(--pill-fg) cursor-pointer transition-[background-color] duration-200 hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-2 focus-visible:outline-[rgba(255,255,255,0.5)] focus-visible:outline-offset-2 [&_svg]:size-5 [&_svg]:opacity-70 [&_svg]:transition-opacity [&_svg]:duration-200 hover:[&_svg]:opacity-100" type="button" ref={dotsRef} aria-label="More options">
            <DotsIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
