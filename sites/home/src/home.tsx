import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { Liquid } from "liquid-gooey";
import { MetalFx } from "metal-fx";
import { ImageGeneration } from "img-fx";

/* Homepage cards — one small self-running preview per library. */

function BeamPreview() {
  return (
    <BorderBeam size="md" theme="dark">
      <div
        style={{
          width: 190,
          padding: "22px 24px",
          borderRadius: 16,
          background: "#1d1d1d",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ height: 10, width: "55%", borderRadius: 4, background: "rgba(238,238,239,0.12)" }} />
        <div style={{ height: 7, width: "100%", borderRadius: 4, background: "rgba(238,238,239,0.08)" }} />
        <div style={{ height: 7, width: "78%", borderRadius: 4, background: "rgba(238,238,239,0.08)" }} />
      </div>
    </BorderBeam>
  );
}

function OrbPreview() {
  return <ThinkingOrb state="searching" size={64} theme="dark" />;
}

function GooeyPreview() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOpen((o) => !o), 2200);
    return () => clearInterval(t);
  }, []);
  const dot: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 22,
    border: 0,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#121212",
    fontSize: 18,
    lineHeight: 1,
  };
  return (
    <Liquid
      blur={6}
      contrast={18}
      fill="#e9e9e9"
      shadow="0 2px 6px rgba(0,0,0,.35)"
      style={{ position: "relative", width: 120, height: 120 }}
    >
      <Liquid.Item
        x={0}
        y={0}
        transition="bouncy"
        style={{ position: "absolute", left: 38, top: 38 }}
      >
        <div style={dot}>+</div>
      </Liquid.Item>
      <Liquid.Item
        x={open ? -34 : 0}
        y={open ? -34 : 0}
        transition="bouncy"
        style={{ position: "absolute", left: 38, top: 38 }}
      >
        <div style={dot} />
      </Liquid.Item>
      <Liquid.Item
        x={open ? 34 : 0}
        y={open ? 34 : 0}
        transition="bouncy"
        delay={40}
        style={{ position: "absolute", left: 38, top: 38 }}
      >
        <div style={dot} />
      </Liquid.Item>
    </Liquid>
  );
}

function MetalPreview() {
  return (
    <MetalFx preset="chromatic" strength={0.9}>
      <button
        type="button"
        style={{
          height: 40,
          padding: "0 18px",
          borderRadius: 26,
          border: 0,
          background: "#1b1b1b",
          color: "#ededed",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Upgrade to Pro
      </button>
    </MetalFx>
  );
}

function ImagePreview() {
  return (
    <ImageGeneration
      preset="pixels-organic"
      images={["/images/gen-1.jpg", "/images/gen-2.jpg", "/images/gen-3.jpg"]}
      autoReveal
    >
      <div style={{ width: 168, height: 168, borderRadius: 18, background: "#1b1b1b" }} />
    </ImageGeneration>
  );
}

/* Studio teaser — static mock of a controls panel. */
function StudioPreview() {
  const row = (label: string, pct: number, i: number) => (
    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(202,202,202,0.7)" }}>{label}</div>
      <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            borderRadius: 2,
            background: "#ededed",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 12,
            borderRadius: 6,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>
    </div>
  );
  return (
    <div
      style={{
        width: 200,
        padding: 18,
        borderRadius: 14,
        background: "#181818",
        boxShadow:
          "0 1px 3px 0 rgba(0,0,0,0.04), inset 0 1px 0 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(196,196,196,0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {row("Strength", 70, 0)}
      {row("Speed", 45, 1)}
      {row("Hue range", 85, 2)}
    </div>
  );
}

function mount(id: string, node: React.ReactNode) {
  const el = document.getElementById(id);
  if (!el) return;
  createRoot(el).render(<StrictMode>{node}</StrictMode>);
}

mount("fx-beam", <BeamPreview />);
mount("fx-orb", <OrbPreview />);
mount("fx-gooey", <GooeyPreview />);
mount("fx-metal", <MetalPreview />);
mount("fx-image", <ImagePreview />);
mount("fx-studio", <StudioPreview />);
