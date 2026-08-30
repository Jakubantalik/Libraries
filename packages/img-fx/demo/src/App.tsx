import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ImageGeneration,
  type ImageGenerationCycleEvent,
  type ImageGenerationHandle,
  type ImageGenerationPreset,
  type ImageGenerationTheme
} from 'img-fx';

// Image pool consumed by all three hero cards + the playground. Kept in sync
// with `../../../images/` (the source-of-truth folder one level above the
// library). When you add/remove a file there, mirror it into
// `demo/public/images/` AND update this list — the four cards coordinate via
// `excludeSrcs` so they never show the same image at once, which only works
// if every URL here actually resolves.
const IMAGE_POOL = [
  '/images/Screenshot 2026-05-13 at 17.22.03.png',
  '/images/Screenshot 2026-05-13 at 17.34.13.png',
  '/images/Screenshot 2026-05-13 at 17.36.02.png',
  '/images/Screenshot 2026-05-13 at 17.36.38.png',
  '/images/Screenshot 2026-05-13 at 17.37.11.png',
  '/images/Screenshot 2026-05-13 at 17.37.37.png',
  '/images/Screenshot 2026-05-13 at 17.37.43.png',
  '/images/Screenshot 2026-05-13 at 17.37.49.png',
  '/images/Screenshot 2026-05-16 at 12.50.03.png',
  '/images/Screenshot 2026-05-16 at 12.51.21.png',
  '/images/Screenshot 2026-05-16 at 12.52.16.png',
  '/images/Screenshot 2026-05-16 at 12.53.21.png',
  '/images/Screenshot 2026-05-16 at 12.55.02.png',
  '/images/Screenshot 2026-05-17 at 19.52.25.png',
  '/images/Screenshot 2026-05-17 at 19.52.55.png',
  '/images/Screenshot 2026-05-17 at 19.53.15.png',
  '/images/Screenshot 2026-05-17 at 19.58.27.png',
  '/images/Screenshot 2026-05-17 at 19.59.07.png',
  '/images/Screenshot 2026-05-17 at 20.01.38.png',
  '/images/Untitled.jpg',
  '/images/Untitled2.jpg',
  '/images/Untitled4.jpg',
  '/images/photo-1773236759289-251d9687b6e3.avif'
];

/** Copy + check glyphs — paths ported from `transitions.dev/skill.html`
 *  (lines 3461-3467). Both icons render permanently inside `.copy-btn`;
 *  the swap is driven by toggling `data-copied` on the parent button so
 *  CSS can crossfade them with the same opacity / scale / blur curves
 *  the template uses. The `icon-copy` / `icon-check` class names mirror
 *  the template so the CSS port stays 1:1. */
function CopyIcon(): JSX.Element {
  return (
    <svg
      className="icon-copy"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      className="icon-check"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GitHubIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** X (formerly Twitter) glyph — outlined variant ported verbatim from the
 *  `Essencial/skill.html` template (line ~3263) so the chip matches the
 *  marketing-site reference. The path has two subpaths with opposite
 *  winding so the default nonzero fill-rule carves out the interior,
 *  giving the hollow/hairline X look. The `icon-x` className is reused
 *  from the template so any future `.icon-btn svg.icon-x` rule applies. */
function XIcon(): JSX.Element {
  return (
    <svg
      className="icon-x"
      aria-hidden="true"
      width="16"
      height="17"
      viewBox="0 0 16 17"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M12.4041 1.39726H14.6953L9.69087 7.2591L15.5781 15.2368H10.9696L7.35741 10.3996L3.22921 15.2368H0.934687L6.28641 8.96575L0.642598 1.39726H5.36795L8.62962 5.81859L12.4041 1.39726ZM11.5992 13.8329H12.8682L4.67667 2.72798H3.31359L11.5992 13.8329Z"
      />
    </svg>
  );
}

function PlayIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <path d="M4.5 2.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

/** Moon / Sun glyphs — paths lifted verbatim from
 *  `transitions.dev/assets/theme-moon-01.svg` and `theme-sun.svg`
 *  (the same assets the template renders via <img>). Inlined as React
 *  components with `fill="currentColor"` so they inherit the parent
 *  `.icon-btn svg` color tokens (muted at rest → full on hover) and
 *  avoid the `brightness(0) invert(1)` filter trickery the template
 *  needs because its <img> tags can't accept a CSS color. */
function MoonIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M6.04458 1.60806C6.1589 1.35528 6.10472 1.05812 5.90855 0.861947C5.71237 0.665775 5.41522 0.611597 5.16244 0.725914C2.51258 1.92428 0.666626 4.59176 0.666626 7.69181C0.666626 11.9121 4.08786 15.3334 8.30817 15.3334C11.4082 15.3334 14.0757 13.4874 15.2741 10.8375C15.3884 10.5848 15.3342 10.2876 15.138 10.0914C14.9419 9.89526 14.6447 9.84108 14.3919 9.9554C13.6009 10.3131 12.7225 10.5126 11.7956 10.5126C8.31168 10.5126 5.4874 7.6883 5.4874 4.20438C5.4874 3.27752 5.68686 2.39905 6.04458 1.60806Z"
      />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="currentColor" d="M8.66663 1.33333C8.66663 0.965143 8.36815 0.666666 7.99996 0.666666C7.63177 0.666666 7.33329 0.965143 7.33329 1.33333V2.66667C7.33329 3.03486 7.63177 3.33333 7.99996 3.33333C8.36815 3.33333 8.66663 3.03486 8.66663 2.66667V1.33333Z" />
      <path fill="currentColor" d="M8.66663 13.3333C8.66663 12.9651 8.36815 12.6667 7.99996 12.6667C7.63177 12.6667 7.33329 12.9651 7.33329 13.3333V14.6667C7.33329 15.0349 7.63177 15.3333 7.99996 15.3333C8.36815 15.3333 8.66663 15.0349 8.66663 14.6667V13.3333Z" />
      <path fill="currentColor" d="M0.666626 8C0.666626 7.63181 0.965103 7.33333 1.33329 7.33333H2.66663C3.03482 7.33333 3.33329 7.63181 3.33329 8C3.33329 8.36819 3.03482 8.66667 2.66663 8.66667H1.33329C0.965103 8.66667 0.666626 8.36819 0.666626 8Z" />
      <path fill="currentColor" d="M3.73797 2.7952C3.47762 2.53485 3.05551 2.53485 2.79516 2.7952C2.53481 3.05555 2.53481 3.47766 2.79516 3.73801L3.73797 4.68081C3.99831 4.94116 4.42042 4.94116 4.68077 4.68081C4.94112 4.42046 4.94112 3.99836 4.68077 3.73801L3.73797 2.7952Z" />
      <path fill="currentColor" d="M13.2048 2.7952C13.4651 3.05555 13.4651 3.47766 13.2048 3.73801L12.262 4.68081C12.0016 4.94116 11.5795 4.94116 11.3192 4.68081C11.0588 4.42046 11.0588 3.99836 11.3192 3.73801L12.262 2.7952C12.5223 2.53485 12.9444 2.53485 13.2048 2.7952Z" />
      <path fill="currentColor" d="M4.68077 12.2647C4.94112 12.0043 4.94112 11.5822 4.68077 11.3219C4.42042 11.0615 3.99831 11.0615 3.73797 11.3219L2.79516 12.2647C2.53481 12.525 2.53481 12.9472 2.79516 13.2075C3.05551 13.4679 3.47762 13.4679 3.73797 13.2075L4.68077 12.2647Z" />
      <path fill="currentColor" d="M11.3192 11.3219C11.5795 11.0615 12.0016 11.0615 12.262 11.3219L13.2048 12.2647C13.4651 12.525 13.4651 12.9472 13.2048 13.2075C12.9444 13.4679 12.5223 13.4679 12.262 13.2075L11.3192 12.2647C11.0588 12.0043 11.0588 11.5822 11.3192 11.3219Z" />
      <path fill="currentColor" d="M13.3333 7.33333C12.9651 7.33333 12.6666 7.63181 12.6666 8C12.6666 8.36819 12.9651 8.66667 13.3333 8.66667H14.6666C15.0348 8.66667 15.3333 8.36819 15.3333 8C15.3333 7.63181 15.0348 7.33333 14.6666 7.33333H13.3333Z" />
      <path fill="currentColor" d="M7.99996 4C5.79082 4 3.99996 5.79086 3.99996 8C3.99996 10.2091 5.79082 12 7.99996 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 7.99996 4Z" />
    </svg>
  );
}


/** Ports the "Copy code" / "Copied" pill tooltip from the Essencial skill.html
 *  template (lines 836-988, 3889-3939). The tooltip's swap slot animates its
 *  width between two labels, so the labels are measured once after mount and
 *  exposed as `--tt-w-a` / `--tt-w-b` CSS custom properties. The icon swap
 *  (copy ⇄ check) and the text swap reset in two stages so the icon flips
 *  back to "copy" 200ms before the text crossfades back to "Copy code". */
function CopyButton({ text, label }: { text: string; label: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [swapState, setSwapState] = useState<'copy' | 'copied'>('copy');
  const swapRef = useRef<HTMLSpanElement | null>(null);
  const iconTimerRef = useRef<number | undefined>(undefined);
  const swapTimerRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const swap = swapRef.current;
    if (!swap) return;
    const labels = swap.querySelectorAll<HTMLElement>('.tt-label');
    const widths: number[] = [];
    labels.forEach((lbl) => {
      const prevPos = lbl.style.position;
      const prevDisp = lbl.style.display;
      lbl.style.position = 'static';
      lbl.style.display = 'inline-block';
      widths.push(lbl.getBoundingClientRect().width);
      lbl.style.position = prevPos;
      lbl.style.display = prevDisp;
    });
    if (widths.length >= 2) {
      swap.style.setProperty('--tt-w-a', widths[0] + 'px');
      swap.style.setProperty('--tt-w-b', widths[1] + 'px');
    }
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(iconTimerRef.current);
      window.clearTimeout(swapTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    // `navigator.clipboard` requires a secure context (HTTPS / localhost).
    // When the demo is opened over a LAN IP on a phone for testing, the
    // page runs in an insecure context and `navigator.clipboard` is
    // `undefined` — the old `.then()` chain would throw synchronously,
    // never flip the icon, and the button looked dead on mobile. Even
    // in a secure context iOS Safari can reject the write (focus loss,
    // user-gesture quirks), which the previous code also ignored.
    //
    // Strategy: try the modern API first when available, fall back to a
    // hidden-<textarea> + `execCommand('copy')` shim that works in any
    // context. Only flip the "copied" state when at least one path
    // actually succeeded so the UI never lies about the clipboard.
    const writeText = async (value: string): Promise<boolean> => {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(value);
          return true;
        } catch {
          // fall through to the execCommand path
        }
      }
      if (typeof document === 'undefined') return false;
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.padding = '0';
      ta.style.border = 'none';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      const sel = document.getSelection();
      const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      if (savedRange && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      return ok;
    };

    const ok = await writeText(text);
    if (!ok) return;
    setCopied(true);
    setSwapState('copied');
    window.clearTimeout(iconTimerRef.current);
    window.clearTimeout(swapTimerRef.current);
    const isTouch =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none)').matches;
    const dwell = isTouch ? 2000 : 1600;
    iconTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      swapTimerRef.current = window.setTimeout(() => {
        setSwapState('copy');
      }, 200);
    }, dwell);
  }, [text]);

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      data-copied={copied ? 'true' : 'false'}
      aria-label={copied ? 'Copied' : label}
    >
      <CopyIcon />
      <CheckIcon />
      <span className="copy-btn-tooltip" role="tooltip" aria-hidden="true">
        <span className="tt-text">
          <span className="tt-stem">Cop</span>
          <span className="tt-swap" ref={swapRef} data-state={swapState}>
            <span className="tt-label tt-a">y code</span>
            <span className="tt-label tt-b">ied</span>
          </span>
        </span>
      </span>
    </button>
  );
}

/** All bundled presets are exposed in the playground's Type picker. */
type PlaygroundPreset = ImageGenerationPreset;

/* Label-to-preset mapping reflects the visual character of each shader, NOT
 * the source JSON filename (preset-pixels-style-3 / -4):
 *   - "Pixel Organic" → pixels-mechanic (Nebula, effect #11) — softer
 *     drifting nebula clouds that read as organic.
 *   - "Pixel Mechanic" → pixels-organic (Chromium Flow, effect #22) —
 *     sharp curved chrome ridges that read as structured / mechanical.
 *   - "Gradient Sweep" → sweep-gradient (effect #25) — fast diagonal
 *     generating sweep with per-cell flicker.
 * Library preset names stay aligned to the source JSONs so consumers
 * importing the package directly aren't affected. */
const PRESET_OPTIONS: Array<{ value: PlaygroundPreset; label: string }> = [
  { value: 'pixels-mechanic', label: 'Pixel Organic' },
  { value: 'pixels-organic', label: 'Pixel Mechanic' },
  { value: 'sweep-gradient', label: 'Gradient Sweep' }
];

// Resolve the OS-level colour preference. Used to seed the initial
// `theme` state and to keep the page in sync if the user flips their
// system theme while the demo is open (e.g. macOS sunset auto-dark).
// SSR-safe — falls back to 'dark' when `window` is unavailable, which
// also matches the synchronous pre-React stamp in `index.html`.
function getSystemTheme(): ImageGenerationTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function App(): JSX.Element {
  // Seed from the OS `prefers-color-scheme` preference. The inline
  // script in `demo/index.html` already stamped `data-theme` before
  // React booted (preventing a flash of the wrong palette), and this
  // `useState` initialiser reads the same media query so React's
  // model stays in sync with the DOM from the very first render.
  const [theme, setTheme] = useState<ImageGenerationTheme>(getSystemTheme);
  // Tracks whether the user has explicitly clicked the theme toggle
  // this session. Once true, we stop following live OS-level changes
  // so the user's manual choice isn't yanked out from under them when
  // their system flips (e.g. macOS sunset auto-dark). Reloading the
  // page resets this — system preference becomes authoritative again.
  const userOverrodeThemeRef = useRef(false);
  const [preset, setPreset] = useState<PlaygroundPreset>('pixels-organic');
  const [strength, setStrength] = useState(100);
  // Playground starts paused so the page loads quietly; the Play/Pause toggle
  // below only flips this local state. The hero examples keep auto-playing.
  const [playgroundPaused, setPlaygroundPaused] = useState(true);
  const [imageRevealed, setImageRevealed] = useState(false);
  const strengthId = useId();
  const playgroundRef = useRef<ImageGenerationHandle | null>(null);

  const handleTogglePlay = useCallback(() => {
    setPlaygroundPaused((p) => !p);
  }, []);
  const handleToggleTheme = useCallback(() => {
    userOverrodeThemeRef.current = true;
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Live-follow the OS theme until the user opts out via the toggle.
  // Listening on `(prefers-color-scheme: light)` (rather than the more
  // common dark query) keeps the polarity the same as `getSystemTheme`
  // above so there's only one source of truth for the mapping.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      if (userOverrodeThemeRef.current) return;
      setTheme(e.matches ? 'light' : 'dark');
    };
    mql.addEventListener('change', onSystemThemeChange);
    return () => mql.removeEventListener('change', onSystemThemeChange);
  }, []);
  const handleToggleReveal = useCallback(() => {
    const handle = playgroundRef.current;
    if (!handle) return;
    if (handle.isImageActive()) {
      handle.triggerHide();
    } else {
      handle.triggerReveal({ hold: 'manual' });
    }
  }, []);
  // One call runs the whole regenerate flow: the revealed image breaks into
  // the effect's churning cell grid (recolored from the image itself), and
  // the next image dissolves in automatically after the churn.
  const handleRegenerate = useCallback(() => {
    playgroundRef.current?.triggerRegenerate({ durationMs: 3000 });
  }, []);

  // Coordinate the four cards so no two ever show the same image at once.
  // Map: card id -> currently-displayed src (set on `reveal`, cleared on `idle`).
  const inUseImagesRef = useRef<Map<string, string>>(new Map());
  const makeCardCoordinator = useCallback(
    (cardId: string) => ({
      excludeSrcs: () => Array.from(inUseImagesRef.current.values()),
      onCycle: (e: ImageGenerationCycleEvent) => {
        if (e.phase === 'reveal' && e.src) {
          inUseImagesRef.current.set(cardId, e.src);
        } else if (e.phase === 'idle') {
          inUseImagesRef.current.delete(cardId);
        }
      }
    }),
    []
  );
  const heroWideCoord = useMemo(() => makeCardCoordinator('hero-wide'), [makeCardCoordinator]);
  const heroTallCoord = useMemo(() => makeCardCoordinator('hero-tall'), [makeCardCoordinator]);
  const heroSquareCoord = useMemo(() => makeCardCoordinator('hero-square'), [makeCardCoordinator]);
  const playgroundBaseCoord = useMemo(
    () => makeCardCoordinator('playground'),
    [makeCardCoordinator]
  );
  // Wrap the playground coordinator so it also drives the local
  // `imageRevealed` state used to flip the toggle button's icon/label.
  const playgroundCoord = useMemo(
    () => ({
      excludeSrcs: playgroundBaseCoord.excludeSrcs,
      onCycle: (e: ImageGenerationCycleEvent) => {
        playgroundBaseCoord.onCycle(e);
        if (e.phase === 'reveal' || e.phase === 'visible') setImageRevealed(true);
        else if (e.phase === 'idle') setImageRevealed(false);
      }
    }),
    [playgroundBaseCoord]
  );

  // Sync the page theme attribute so background + chrome match.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Card surface tokens for the four demo cards. Both themes override the
  // preset's bundled cardBg so all examples share one consistent surface
  // rather than picking up whatever neutral each preset JSON ships with:
  //   - Dark:  #1B1B1B (near-black, +0.06 luminance over the page bg #070707)
  //   - Light: #EEEEEF (warm off-white, sits just under the page bg #fdfdfd
  //                     and reads as a quiet card on the lighter wash surface)
  const demoCardBg = theme === 'dark' ? '#1B1B1B' : '#EEEEEF';
  const installCmd = 'npm install img-fx';
  // Both code snippets below are designed to be copy-paste runnable: full
  // imports, real function components, inline image URLs as placeholders.
  // `playgroundCode` mirrors the actual playground toggle logic — note the
  // `hold: 'manual'` and the `isImageActive()` / `triggerHide()` round-trip,
  // not a bare `triggerReveal()` (which would auto-hide after `revealHoldMs`).
  const usageCode = `import { ImageGeneration } from 'img-fx';

export function Card() {
  return (
    <ImageGeneration
      preset="${preset}"
      images={['/a.jpg', '/b.jpg']}
      autoReveal
    >
      <div style={{ width: 280, height: 280, borderRadius: 16 }} />
    </ImageGeneration>
  );
}`;
  const playgroundCode = `import { useRef } from 'react';
import { ImageGeneration, type ImageGenerationHandle } from 'img-fx';

export function Card() {
  const ref = useRef<ImageGenerationHandle>(null);

  const onToggle = () => {
    const h = ref.current;
    if (!h) return;
    if (h.isImageActive()) h.triggerHide();
    else h.triggerReveal({ hold: 'manual' });
  };

  // Regenerate in place: the revealed image breaks into the effect's
  // churning pixel grid (tinted from the image itself), then the next
  // image dissolves in automatically.
  const onRegenerate = () => ref.current?.triggerRegenerate({ durationMs: 3000 });

  return (
    <>
      <ImageGeneration
        ref={ref}
        preset="${preset}"
        strength={${(strength / 100).toFixed(2)}}
        images={['/a.jpg', '/b.jpg']}
      >
        <div style={{ width: 280, height: 280, borderRadius: 16 }} />
      </ImageGeneration>
      <button onClick={onToggle}>Reveal / hide</button>
      <button onClick={onRegenerate}>Regenerate</button>
    </>
  );
}`;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <main id="main-content" className="app">
        <header className="header">
          <nav aria-label="External links" className="top-bar-links">
            <button
              type="button"
              className="icon-btn theme-toggle"
              onClick={handleToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {/* Port of skill.html .theme-icon-stack: both icons live in
                  DOM permanently and crossfade via opacity/scale/blur
                  driven by `data-active`. data-active="moon" when the
                  user is in light mode (clicking flips to dark, moon
                  visible to convey the action), and "sun" in dark mode. */}
              <span
                className="theme-icon-stack"
                data-active={theme === 'dark' ? 'sun' : 'moon'}
                aria-hidden="true"
              >
                <MoonIcon className="theme-icon theme-icon-moon" />
                <SunIcon className="theme-icon theme-icon-sun" />
              </span>
            </button>
            <a
              className="icon-btn"
              href="https://github.com/Jakubantalik/img-fx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
            >
              <GitHubIcon />
            </a>
            <a
              className="icon-btn"
              href="https://x.com/jakubantalik"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow on X (Twitter)"
            >
              <XIcon />
            </a>
          </nav>
          {/* Two PNG/JPG variants instead of one shared asset: the silver
           * `image-header.png` reads well on the near-black dark surface
           * but loses contrast on the near-white light surface, where the
           * pixel cells wash out. The dedicated `image-header-light.jpg`
           * has a softer white-on-white body so the silhouette still
           * registers in light mode.
           *
           * Both <img>s live in the DOM permanently and CSS swaps which
           * one is `display: block` via the html[data-theme] attribute —
           * port of skill.html .header-icon-img--light/--dark (lines
           * 607-615). With a single <img> + theme-conditional `src`, the
           * browser dropped the old asset and re-decoded the new one on
           * every theme toggle, which read as a flash. With both decoded
           * up front the swap is instant. */}
          <div className="header-icon" aria-hidden="true">
            <img
              className="header-icon-img header-icon-img--dark"
              src="/image-header.png"
              alt=""
              width={207}
              height={138}
              decoding="async"
            />
            <img
              className="header-icon-img header-icon-img--light"
              src="/image-header-light.jpg"
              alt=""
              width={207}
              height={138}
              decoding="async"
            />
          </div>
          <h1 className="title">Image loader</h1>
          <p className="subtitle-sm">Image generation loader and reveal component</p>
        </header>

        <section className="examples-section" aria-label="Effect demonstrations">
          {/* Hero card 1 — labelled "Pixel Organic" in the playground —
              uses the Nebula preset (effect #11) since its softer drifting
              clouds read as organic. The library preset name stays
              `pixels-mechanic` to match the source JSON file. */}
          <div className="example-row-full">
            <ImageGeneration
              preset="pixels-mechanic"
              theme={theme}
              cardBg={demoCardBg}
              images={IMAGE_POOL}
              autoReveal
              revealDelayRange={[2, 4]}
              revealHoldMs={[750, 1250]}
              className="hero-card-wide"
              excludeSrcs={heroWideCoord.excludeSrcs}
              onCycle={heroWideCoord.onCycle}
            >
              <div />
            </ImageGeneration>
          </div>
          <div className="example-row-split">
            {/* Hero card 2 — Pixel Mechanic (Chromium Flow): sharp curved
                chrome ridges with structured/mechanical feel. Random 1-3s
                initial offset staggers it after card 1. Image hold is
                randomised 0.75-1.25s per cycle. */}
            <div className="example-cell">
              <ImageGeneration
                preset="pixels-organic"
                theme={theme}
                cardBg={demoCardBg}
                images={IMAGE_POOL}
                autoReveal
                revealDelayRange={[2.5, 4.5]}
                revealInitialDelay={[1, 3]}
                revealHoldMs={[750, 1250]}
                className="hero-card-tall"
                excludeSrcs={heroTallCoord.excludeSrcs}
                onCycle={heroTallCoord.onCycle}
              >
                <div />
              </ImageGeneration>
            </div>
            {/* Hero card 3 — Gradient Sweep (effect #25): fast diagonal
                generating sweep with per-cell flicker, revealed through the
                gradientSweep mask. */}
            <div className="example-cell">
              <ImageGeneration
                preset="sweep-gradient"
                theme={theme}
                cardBg={demoCardBg}
                images={IMAGE_POOL}
                autoReveal
                revealDelayRange={[2, 3.5]}
                revealInitialDelay={[1, 3]}
                revealHoldMs={[750, 1250]}
                className="hero-card"
                excludeSrcs={heroSquareCoord.excludeSrcs}
                onCycle={heroSquareCoord.onCycle}
              >
                <div />
              </ImageGeneration>
            </div>
          </div>
        </section>

        <section className="section" aria-label="Installation">
          <h2 className="section-title">Installation</h2>
          <div className="code-block">
            <code>{installCmd}</code>
            <CopyButton text={installCmd} label="Copy install command" />
          </div>
        </section>

        <section className="section" aria-label="Usage">
          <h2 className="section-title section-title--muted">Usage</h2>
          <div className="code-block code-block--multi">
            <code>{usageCode}</code>
            <CopyButton text={usageCode} label="Copy usage example" />
          </div>
        </section>

        <section className="playground-section" aria-label="Interactive playground">
          <h2 className="section-title">Playground</h2>

          <div className="playground-controls">
            <div className="control-group" role="radiogroup" aria-label="Type">
              <span className="control-label">Type</span>
              <div className="control-options">
                {PRESET_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className="tab-btn"
                    role="radio"
                    aria-checked={preset === value}
                    data-active={preset === value}
                    onClick={() => setPreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group control-group--strength">
              <label className="control-label" htmlFor={strengthId}>
                Strength
              </label>
              <div className="strength-track">
                {strength > 0 && <div className="strength-fill" style={{ width: `${strength}%` }} />}
                <span className="strength-value">{strength}%</span>
                <input
                  id={strengthId}
                  type="range"
                  className="strength-input"
                  value={strength}
                  onChange={(e) => setStrength(parseInt(e.target.value, 10))}
                  min={0}
                  max={100}
                  step={1}
                  aria-label="Effect strength"
                />
              </div>
            </div>
          </div>

          <div className="playground-preview">
            <ImageGeneration
              ref={playgroundRef}
              preset={preset}
              theme={theme}
              cardBg={demoCardBg}
              strength={strength / 100}
              images={IMAGE_POOL}
              paused={playgroundPaused}
              excludeSrcs={playgroundCoord.excludeSrcs}
              onCycle={playgroundCoord.onCycle}
            >
              <div className="playground-card" />
            </ImageGeneration>

            <div className="playground-toolbar">
              <button
                type="button"
                className="playground-toggle"
                onClick={handleTogglePlay}
                aria-pressed={!playgroundPaused}
                aria-label={playgroundPaused ? 'Play shader animation' : 'Pause shader animation'}
                title={playgroundPaused ? 'Play' : 'Pause'}
              >
                {playgroundPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <button
                type="button"
                className="playground-toggle playground-toggle--text"
                onClick={handleToggleReveal}
                aria-pressed={imageRevealed}
                disabled={playgroundPaused}
                aria-disabled={playgroundPaused}
                title={playgroundPaused ? 'Press Play to enable' : undefined}
              >
                {imageRevealed ? 'Hide image' : 'Reveal image'}
              </button>
              <button
                type="button"
                className="playground-toggle playground-toggle--text"
                onClick={handleRegenerate}
                disabled={playgroundPaused || !imageRevealed}
                aria-disabled={playgroundPaused || !imageRevealed}
                title={
                  playgroundPaused
                    ? 'Press Play to enable'
                    : !imageRevealed
                      ? 'Reveal an image first'
                      : undefined
                }
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="code-block code-block--multi">
            <code>{playgroundCode}</code>
            <CopyButton text={playgroundCode} label="Copy playground code" />
          </div>
        </section>

        <footer className="footer">
          <span className="footer-muted">Made by</span>{' '}
          <a
            className="footer-name"
            href="https://x.com/jakubantalik"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jakub Antalik
          </a>
        </footer>
      </main>
    </>
  );
}
