import { createRoot } from "react-dom/client";
import { ThinkingStatus } from "./studio/controls";

/* How to use, step 3: the thinking line in the recreated agent panel is the
   Studio's own ThinkingStatus (controls.tsx) — orb, shimmer and the line
   swap, unchanged — so the mock reads as the real thing. The static row in
   the markup stands in until this mounts. */

const mount = document.getElementById("howto-agent-status");
if (mount) {
  mount.textContent = "";
  createRoot(mount).render(<ThinkingStatus />);
}
