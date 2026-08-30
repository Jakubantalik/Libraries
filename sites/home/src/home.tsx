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



/* Hero tiles — miniature self-running previews inside the 108px stages. */

function TileBeam() {
  return (
    <BorderBeam size="sm" theme="dark">
      <div style={{ width: 72, height: 44, borderRadius: 10, background: "#1d1d1d" }} />
    </BorderBeam>
  );
}

function TileOrb() {
  return <ThinkingOrb state="searching" size={64} theme="dark" />;
}

function TileGooey() {
  return (
    <div style={{ transform: "scale(0.62)", transformOrigin: "center" }}>
      <GooeyPreview />
    </div>
  );
}

function TileMetal() {
  return (
    <MetalFx variant="circle" preset="chromatic" strength={0.9}>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          border: 0,
          background: "#1b1b1b",
          color: "#ededed",
          fontSize: 15,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {"\u2191"}
      </button>
    </MetalFx>
  );
}

function TileImage() {
  return (
    <ImageGeneration
      preset="pixels-organic"
      images={["/images/gen-1.jpg", "/images/gen-2.jpg", "/images/gen-3.jpg"]}
      autoReveal
    >
      <div style={{ width: 84, height: 84, borderRadius: 12, background: "#1b1b1b" }} />
    </ImageGeneration>
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
mount("tile-beam", <TileBeam />);
mount("tile-orb", <TileOrb />);
mount("tile-gooey", <TileGooey />);
mount("tile-metal", <TileMetal />);
mount("tile-image", <TileImage />);
