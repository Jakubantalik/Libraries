import React, { useState } from 'react';
import { CopyButton } from './components/CopyButton';
import { Examples } from './components/Examples';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Playground } from './components/Playground';
import { useTheme } from './hooks/useTheme';

export function App() {
  const [theme, toggleTheme] = useTheme();
  // Strength lives on App so the Playground slider drives both the playground
  // preview AND the hero examples above. Stored as 0..100 to match the slider
  // range; consumers convert to 0..1 via `strength / 100`. Default 90% leaves
  // a bit of headroom so the metal effect feels lively without saturating the
  // ring on first paint.
  const [strength, setStrength] = useState(90);

  return (
    <main className="flex flex-col items-center max-w-[883px] mx-auto w-full px-6 pb-16 max-sm:px-4 max-sm:pb-12">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <Examples theme={theme} strength={strength / 100} />

      <section className="w-full mb-6" aria-label="Installation">
        <h2 className="text-base font-normal leading-[34px] text-(--section-title-color) mb-1">Installation</h2>
        <div className="flex items-center h-10 bg-(--code-bg) rounded-[10px] py-0.5 pr-10 pl-3 overflow-hidden relative">
          <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">npm install metal-fx</code>
          <CopyButton getText={() => 'npm install metal-fx'} />
        </div>
      </section>

      <section className="w-full mb-6" aria-label="Usage">
        <h2 className="text-base font-normal leading-[34px] text-(--section-title-muted) mb-1">Usage</h2>
        <div className="flex items-start h-auto bg-(--code-bg) rounded-[10px] py-1.5 pr-10 pl-3 overflow-hidden relative">
          <code className="font-[Roboto_Mono,monospace] text-sm leading-[22px] text-(--code-text) whitespace-pre overflow-x-auto min-w-0 flex-1">{`import { MetalFx } from 'metal-fx';\n\n<MetalFx preset="chromatic" strength={1}>\n  <button>Upgrade to Pro</button>\n</MetalFx>`}</code>
          <CopyButton getText={() => `import { MetalFx } from 'metal-fx';\n\n<MetalFx preset="chromatic" strength={1}>\n  <button>Upgrade to Pro</button>\n</MetalFx>`} />
        </div>
      </section>

      <Playground theme={theme} strength={strength} onStrengthChange={setStrength} />

      <Footer />
    </main>
  );
}
