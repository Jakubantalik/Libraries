import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useScrollFade } from "./useScrollFade";

/* The snippet card's copy button — transitions.dev's .detail-code-copy
   riding .card-copy, whose icon crossfade and tooltip already live in
   site.css.

   site.js wires the static .card-copy buttons on the page, but these mount
   with React after it has run and hold their text in a closure rather than
   a data attribute, so the tooltip is built here instead.

   The tooltip reads "Copy code" and swaps the tail to "…ied" on copy. The
   swap animates its width between the two labels, which means both have to
   be measured up front: .tt-b is absolutely positioned so it can cross-blur
   in place, so it is briefly made static (with .tt-a hidden) to take a real
   width. Measured after fonts settle, since the fallback face measures
   wider than Inter. */
export function CodeCopy({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const swapRef = useRef<HTMLSpanElement | null>(null);
  const aRef = useRef<HTMLSpanElement | null>(null);
  const bRef = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const measure = () => {
      const swap = swapRef.current;
      const a = aRef.current;
      const b = bRef.current;
      if (!swap || !a || !b) return;
      const wa = a.getBoundingClientRect().width;
      const prevPos = b.style.position;
      b.style.position = "static";
      a.style.display = "none";
      const wb = b.getBoundingClientRect().width;
      a.style.display = "";
      b.style.position = prevPos;
      swap.style.setProperty("--tt-w-a", `${wa}px`);
      swap.style.setProperty("--tt-w-b", `${wb}px`);
    };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [text]);

  return (
    <button
      type="button"
      className="detail-code-copy card-copy"
      onClick={handleClick}
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? "Copied" : label}
    >
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
      <svg className="icon-check" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.46889L6.26923 11.58L12.5 4.58" /></svg>
      <span className="card-copy-tooltip" aria-hidden="true">
        <span className="tt-text">
          Cop
          <span className="tt-swap" ref={swapRef} data-state={copied ? "copied" : undefined}>
            <span className="tt-label tt-a" ref={aRef}>
              y code
            </span>
            <span className="tt-label tt-b" ref={bRef}>
              ied
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

/** The snippet card: a scrolling <pre> that fades at whichever edge still
 *  has code beyond it, with the copy button above it. */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  const preRef = useScrollFade(code);
  return (
    <div className={className ? `code-block ${className}` : "code-block"}>
      <pre ref={preRef}>{code}</pre>
      <CodeCopy text={code} label={label} />
    </div>
  );
}
