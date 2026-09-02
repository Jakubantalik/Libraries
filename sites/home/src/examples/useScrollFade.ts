import { useEffect, useRef } from "react";

/* A code block that says which way it can still be scrolled: the edge the
   content continues past gets a soft fade (playground.css reads the
   attribute), and an edge with nothing beyond it gets none — so the fade is
   information rather than decoration. Both edges are checked, since
   scrolling right leaves content cut off on the left.

   Shared by the public playgrounds and the Studio, which draw the same
   snippet card behind different copy buttons. */
export function useScrollFade(code: string) {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    const update = () => {
      /* A 2px slack absorbs sub-pixel widths, which would otherwise leave a
         permanent fade on a block that is not actually scrollable. */
      const more = pre.scrollWidth - pre.clientWidth - pre.scrollLeft > 2;
      const before = pre.scrollLeft > 2;
      pre.setAttribute("data-fade", more && before ? "both" : more ? "right" : before ? "left" : "none");
    };
    update();
    pre.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(pre);
    return () => {
      pre.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [code]);

  return preRef;
}
