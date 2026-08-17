import React, { useState } from 'react';
import { CopyButton } from './components/CopyButton';
import { Examples } from './components/Examples';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Playground } from './components/Playground';
import { TabBtn } from './components/TabBtn';
import { useTheme } from './hooks/useTheme';
import {
  INSTALL_BY_PLATFORM,
  INSTALL_NOTE_BY_PLATFORM,
  PLATFORM_OPTIONS,
  USAGE_BY_PLATFORM,
  type Platform,
} from './lib/platforms';

export function App() {
  const [theme, toggleTheme] = useTheme();
  // Speed lives on App so the Playground slider drives both the playground
  // preview AND the hero examples above. Stored as 25..300 percent to match
  // the slider range; consumers convert to a multiplier via `speed / 100`.
  const [speed, setSpeed] = useState(100);
  // Dev-only: strip the gray hero surfaces to inspect the orbs in isolation.
  const [debug, setDebug] = useState(false);
  // Dev-only: render the small chips as large pills.
  const [bigChips, setBigChips] = useState(false);
  // Dev-only: force every pill (hero + chips) to the small chip style.
  const [smallAll, setSmallAll] = useState(false);
  const [platform, setPlatform] = useState<Platform>('react');

  const installCmd = INSTALL_BY_PLATFORM[platform];
  const usageCode = USAGE_BY_PLATFORM[platform];
  const installNote = INSTALL_NOTE_BY_PLATFORM[platform];

  return (
    <main className="flex flex-col items-center max-w-[883px] mx-auto w-full px-6 pb-16 max-sm:px-4 max-sm:pb-12">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        debug={debug}
        onToggleDebug={() => setDebug((d) => !d)}
        bigChips={bigChips}
        onToggleBigChips={() => setBigChips((b) => !b)}
        smallAll={smallAll}
        onToggleSmallAll={() => setSmallAll((s) => !s)}
      />

      <Examples speed={speed / 100} debug={debug} bigChips={bigChips} smallAll={smallAll} />

      <section className="w-full mb-6" aria-label="Installation">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h2 className="text-base font-normal leading-[34px] text-(--section-title-color)">Installation</h2>
          <div className="flex gap-1" role="radiogroup" aria-label="Platform">
            {PLATFORM_OPTIONS.map(({ value, label }) => (
              <TabBtn
                key={value}
                active={platform === value}
                role="radio"
                aria-checked={platform === value}
                onClick={() => setPlatform(value)}
              >
                {label}
              </TabBtn>
            ))}
          </div>
        </div>
        <div className="flex items-center h-10 bg-(--code-bg) rounded-[10px] py-0.5 pr-10 pl-3 overflow-hidden relative">
          <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">{installCmd}</code>
          <CopyButton getText={() => installCmd} />
        </div>
        {installNote && (
          <p className="mt-2 text-[13px] leading-[20px] text-(--section-title-muted)">{installNote}</p>
        )}
      </section>

      <section className="w-full mb-6" aria-label="Usage">
        <h2 className="text-base font-normal leading-[34px] text-(--section-title-muted) mb-1">Usage</h2>
        <div className="flex items-start h-auto bg-(--code-bg) rounded-[10px] py-1.5 pr-10 pl-3 overflow-hidden relative">
          <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">{usageCode}</code>
          <CopyButton getText={() => usageCode} />
        </div>
      </section>

      <Playground speed={speed} onSpeedChange={setSpeed} />

      <Footer />
    </main>
  );
}
