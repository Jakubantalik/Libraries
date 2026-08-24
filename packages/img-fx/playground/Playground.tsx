import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageGeneration,
  type ImageGenerationHandle,
  type ImageGenerationPreset,
  type ImageGenerationTheme
} from '../src';

const IMAGES = [
  '/images/Untitled.jpg',
  '/images/Untitled2.jpg',
  '/images/Untitled4.jpg',
  '/images/Untitled5.jpg',
  '/images/Screenshot 2026-05-13 at 17.22.03.png',
  '/images/Screenshot 2026-05-13 at 17.34.13.png',
  '/images/Screenshot 2026-05-13 at 17.36.02.png',
  '/images/Screenshot 2026-05-13 at 17.36.38.png',
  '/images/Screenshot 2026-05-13 at 17.37.11.png',
  '/images/Screenshot 2026-05-13 at 17.37.37.png',
  '/images/Screenshot 2026-05-13 at 17.37.43.png',
  '/images/Screenshot 2026-05-13 at 17.37.49.png',
  '/images/photo-1773236759289-251d9687b6e3.avif',
  '/images/photo-1777324369706-609d83aece87.avif'
];

const PRESET_OPTIONS: Array<{ value: ImageGenerationPreset; label: string }> = [
  { value: 'pixels-mechanic', label: 'Pixel Organic' },
  { value: 'pixels-organic', label: 'Pixel Mechanic' },
  { value: 'sweep-gradient', label: 'Gradient Sweep' }
];

const THEME_OPTIONS: Array<{ value: ImageGenerationTheme; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' }
];

export function Playground(): JSX.Element {
  const [preset, setPreset] = useState<ImageGenerationPreset>('pixels-organic');
  const [theme, setTheme] = useState<ImageGenerationTheme>('auto');
  const [strength, setStrength] = useState(100);
  const [autoReveal, setAutoReveal] = useState(true);
  const [paused, setPaused] = useState(false);
  const [cardBg, setCardBg] = useState<string>('');
  const [cardSize, setCardSize] = useState(320);
  const cardRef = useRef<ImageGenerationHandle | null>(null);
  const handleManualReveal = useCallback(() => {
    cardRef.current?.triggerReveal();
  }, []);

  // Sync the page background to the resolved theme so the card visually matches.
  useEffect(() => {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <div className="pg-page">
      <div className="pg-header">
        <div className="pg-title">img-fx playground</div>
      </div>

      <div className="pg-toolbar">
        <div className="pg-control" role="radiogroup" aria-label="Preset">
          <span className="pg-control-label">Preset</span>
          <div className="pg-toggle-row">
            {PRESET_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`tab-btn${preset === o.value ? ' active' : ''}`}
                onClick={() => setPreset(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-control" role="radiogroup" aria-label="Theme">
          <span className="pg-control-label">Theme</span>
          <div className="pg-toggle-row">
            {THEME_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`tab-btn${theme === o.value ? ' active' : ''}`}
                onClick={() => setTheme(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-control">
          <label htmlFor="pg-strength">Strength ({strength}%)</label>
          <input
            id="pg-strength"
            className="pg-num"
            type="range"
            min={0}
            max={100}
            step={1}
            value={strength}
            onChange={(e) => setStrength(parseInt(e.target.value, 10))}
          />
        </div>

        <div className="pg-control">
          <span className="pg-control-label">Loop</span>
          <div className="pg-toggle-row">
            <button
              type="button"
              className={`tab-btn${autoReveal ? ' active' : ''}`}
              onClick={() => setAutoReveal((v) => !v)}
            >
              {autoReveal ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className={`tab-btn${paused ? ' active' : ''}`}
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="tab-btn" onClick={handleManualReveal}>
              Reveal once
            </button>
          </div>
        </div>

        <div className="pg-control">
          <label htmlFor="pg-cardbg">Card BG</label>
          <input
            id="pg-cardbg"
            className="pg-num"
            type="text"
            placeholder="(preset)"
            value={cardBg}
            onChange={(e) => setCardBg(e.target.value)}
            style={{ width: 110 }}
          />
        </div>

        <div className="pg-control">
          <label htmlFor="pg-size">Size ({cardSize}px)</label>
          <input
            id="pg-size"
            className="pg-num"
            type="range"
            min={120}
            max={640}
            step={10}
            value={cardSize}
            onChange={(e) => setCardSize(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      <div className="pg-preview">
        <ImageGeneration
          ref={cardRef}
          preset={preset}
          theme={theme}
          strength={strength / 100}
          cardBg={cardBg.trim() ? cardBg.trim() : undefined}
          images={IMAGES}
          autoReveal={autoReveal}
          paused={paused}
        >
          <div style={{ width: cardSize, height: cardSize, borderRadius: 20 }} />
        </ImageGeneration>
      </div>
    </div>
  );
}
