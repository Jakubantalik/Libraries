import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GooeyStudio } from "./studio/gooey";

/* Gooey detail page — renders the Studio's Gooey workbench rather than a
   second, thinner copy of it. The Studio demos are the live gooey demo
   page's prototypes ported verbatim (same geometry, physics defaults,
   fills and shadows) and cover all four effects: morph, move, bend and
   melt. The page this replaced had only morph and move, on an older set
   of prototypes. */

const rootEl = document.getElementById("playground-root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <GooeyStudio />
    </StrictMode>
  );
}
