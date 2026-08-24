/** Animation loop, per-frame compositing, and instance lifecycle. */
import { hexToRgba } from '../color';
import { FRAME_INTERVAL_MS, GLOW_SKIP_FRAMES } from '../perfConfig';
import { PRESETS, type PresetMode, type PresetName, type PresetTheme } from '../presets';
import {
  SHARED,
  CANONICAL_PILL_W,
  CANONICAL_PILL_H,
  CIRCLE_SHADER_SCALE,
  PILL_SHADER_SCALE,
  ensureSharedRenderer,
  setContextRestoredCallback,
  teardownSharedRenderer,
  type MetalFxInstance,
} from './core';
import { ensureGlowPixels } from './sampling';

// Restart the animation loop when the browser restores the GL context.
setContextRestoredCallback(() => {
  if (SHARED && SHARED.instances.size > 0 && SHARED.pausedAtMs === null) {
    startSharedLoop();
  }
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!SHARED || SHARED.pausedAtMs !== null || SHARED.contextLost) return;
    if (document.hidden) {
      stopSharedLoop();
    } else if (SHARED.instances.size > 0) {
      startSharedLoop();
    }
  });
}

// ─── Instance lifecycle ───────────────────────────────────────────────────

interface CreateInstanceOptions {
  hostCanvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  cornerRadius: number;
  kind: 'pill' | 'circle';
  shaderScale?: number;
  ringCssPx?: number;
  opacityMul?: number;
  paused?: boolean;
  scale?: number;
  onAfterFrame?: () => void;
  onFirstCopy?: () => void;
}

export function createInstance(opts: CreateInstanceOptions): MetalFxInstance {
  const renderer = ensureSharedRenderer();
  const ctx = opts.hostCanvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('metal-fx: canvas 2D context unavailable');

  const scale = opts.scale ?? 1;
  const inst: MetalFxInstance = {
    canvas: opts.hostCanvas, ctx,
    cssWidth: opts.cssWidth, cssHeight: opts.cssHeight,
    cornerRadius: opts.cornerRadius,
    kind: opts.kind,
    ringCssPx: opts.ringCssPx ?? (opts.kind === 'circle' ? 2 : 1) * scale,
    shaderScale: opts.shaderScale ?? (opts.kind === 'circle' ? CIRCLE_SHADER_SCALE : PILL_SHADER_SCALE) * scale,
    opacityMul: opts.opacityMul ?? 1,
    visible: true,
    paused: opts.paused ?? false,
    everCopied: false,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    scale,
    onAfterFrame: opts.onAfterFrame,
    onFirstCopy: opts.onFirstCopy,
  };
  resizeInstanceCanvas(inst);
  renderer.instances.add(inst);
  if (renderer.rafId === 0 && renderer.pausedAtMs === null) startSharedLoop();
  return inst;
}

export function destroyInstance(inst: MetalFxInstance): void {
  if (!SHARED) return;
  SHARED.instances.delete(inst);
  const qi = SHARED.glowQueue.indexOf(inst);
  if (qi !== -1) SHARED.glowQueue.splice(qi, 1);
  if (SHARED.instances.size === 0) { stopSharedLoop(); teardownSharedRenderer(); }
}

export function registerGlowInstance(inst: MetalFxInstance): void {
  if (!SHARED) return;
  if (!SHARED.glowQueue.includes(inst)) SHARED.glowQueue.push(inst);
}

export function unregisterGlowInstance(inst: MetalFxInstance): void {
  if (!SHARED) return;
  const i = SHARED.glowQueue.indexOf(inst);
  if (i !== -1) SHARED.glowQueue.splice(i, 1);
}

export function updateInstance(
  inst: MetalFxInstance,
  patch: Partial<Pick<MetalFxInstance, 'cssWidth' | 'cssHeight' | 'cornerRadius' | 'kind' | 'shaderScale' | 'ringCssPx' | 'opacityMul' | 'paused' | 'scale'>>
): void {
  let dirty = false;
  if (patch.cssWidth !== undefined && patch.cssWidth !== inst.cssWidth) { inst.cssWidth = patch.cssWidth; dirty = true; }
  if (patch.cssHeight !== undefined && patch.cssHeight !== inst.cssHeight) { inst.cssHeight = patch.cssHeight; dirty = true; }
  if (patch.cornerRadius !== undefined) inst.cornerRadius = patch.cornerRadius;
  if (patch.scale !== undefined) inst.scale = patch.scale;
  if (patch.kind !== undefined && patch.kind !== inst.kind) {
    inst.kind = patch.kind;
    if (patch.shaderScale === undefined) inst.shaderScale = (patch.kind === 'circle' ? CIRCLE_SHADER_SCALE : PILL_SHADER_SCALE) * inst.scale;
    if (patch.ringCssPx === undefined) inst.ringCssPx = (patch.kind === 'circle' ? 2 : 1) * inst.scale;
  }
  if (patch.shaderScale !== undefined) inst.shaderScale = patch.shaderScale;
  if (patch.ringCssPx !== undefined) inst.ringCssPx = patch.ringCssPx;
  if (patch.opacityMul !== undefined) inst.opacityMul = patch.opacityMul;
  if (patch.paused !== undefined && patch.paused !== inst.paused) {
    inst.paused = patch.paused;
    // Unpausing should kick the loop if it had idled because every visible
    // instance was paused.
    if (!patch.paused && SHARED && SHARED.rafId === 0 && SHARED.pausedAtMs === null && !SHARED.contextLost) {
      startSharedLoop();
    }
  }
  if (dirty) resizeInstanceCanvas(inst);
}

export function setInstanceVisible(inst: MetalFxInstance, visible: boolean): void {
  inst.visible = visible;
  if (visible && SHARED && SHARED.rafId === 0 && SHARED.pausedAtMs === null && !SHARED.contextLost) {
    startSharedLoop();
  }
}

/** Set by `setSharedPresetMode`. While non-null it wins over the named
 *  presets, so a live tuning surface isn't fighting every `<MetalFx preset>`
 *  effect that re-runs on a theme toggle. */
let presetOverride: PresetMode | null = null;

export function setSharedPreset(name: PresetName, theme: PresetTheme): void {
  const s = ensureSharedRenderer();
  s.preset = presetOverride ?? PRESETS[name].modes[theme];
  s.presetDirty = true;
}

/**
 * Push raw Paper liquidMetal parameters into the shared renderer, bypassing
 * the named presets. Pass `null` to hand control back to `preset` / `theme`.
 *
 * This exists for the playground: every instance shares one GL program, so
 * tuning is necessarily global rather than per-instance.
 */
export function setSharedPresetMode(mode: PresetMode | null): void {
  const s = ensureSharedRenderer();
  presetOverride = mode;
  if (mode) {
    s.preset = mode;
    s.presetDirty = true;
  }
}

export function pauseShared(): void {
  if (!SHARED || SHARED.pausedAtMs !== null) return;
  SHARED.pausedAtMs = performance.now();
  stopSharedLoop();
}

export function resumeShared(): void {
  if (!SHARED || SHARED.pausedAtMs === null) return;
  SHARED.pausedMs += performance.now() - SHARED.pausedAtMs;
  SHARED.pausedAtMs = null;
  if (SHARED.instances.size > 0) startSharedLoop();
}

export function getSharedFrameCount(): number {
  return SHARED?.frameCount ?? 0;
}

// ─── Glow callback ────────────────────────────────────────────────────────

export type GlowCallback = (inst: MetalFxInstance, nowMs: number) => void;
let _glowCallback: GlowCallback | null = null;

export function setGlowCallback(cb: GlowCallback | null): void {
  _glowCallback = cb;
}

// ─── Internal rendering ───────────────────────────────────────────────────

function resizeInstanceCanvas(inst: MetalFxInstance): void {
  inst.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const w = Math.max(1, Math.round(inst.cssWidth * inst.dpr));
  const h = Math.max(1, Math.round(inst.cssHeight * inst.dpr));
  if (inst.canvas.width !== w) inst.canvas.width = w;
  if (inst.canvas.height !== h) inst.canvas.height = h;
}

function punchInnerHole(inst: MetalFxInstance): void {
  const { ctx, dpr, canvas } = inst;
  const stroke = inst.ringCssPx * dpr;
  const w = canvas.width, h = canvas.height;
  const innerR = Math.max(0, (inst.cornerRadius - inst.ringCssPx) * dpr);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(stroke, stroke, w - 2 * stroke, h - 2 * stroke, innerR);
  ctx.fill();
  ctx.restore();
}

function copyShaderToInstance(inst: MetalFxInstance): void {
  if (!SHARED) return;
  const src: CanvasImageSource = SHARED.frameBitmap ?? SHARED.glCanvas;
  const dpr = inst.dpr;
  const dw = inst.canvas.width, dh = inst.canvas.height;
  if (dw < 1 || dh < 1) return;

  const cw = SHARED.glCanvas.width, ch = SHARED.glCanvas.height;
  const bdW = CANONICAL_PILL_W * dpr, bdH = CANONICAL_PILL_H * dpr;
  let srcW = (dw * (cw / bdW)) / inst.shaderScale;
  let srcH = (dh * (ch / bdH)) / inst.shaderScale;
  if (srcW > cw) srcW = cw;
  if (srcH > ch) srcH = ch;
  const sx = Math.max(0, (cw - srcW) / 2);
  const sy = Math.max(0, (ch - srcH) / 2);

  // Paper's shader has no `u_shaderOpacity` equivalent, so the preset-level
  // opacity rides along with the per-instance `strength` multiplier here
  // instead of being applied on the GPU.
  const alpha = inst.opacityMul * SHARED.preset.shaderOpacity;

  inst.ctx.clearRect(0, 0, dw, dh);
  if (alpha < 1) inst.ctx.globalAlpha = alpha;
  inst.ctx.drawImage(src, sx, sy, srcW, srcH, 0, 0, dw, dh);
  if (alpha < 1) inst.ctx.globalAlpha = 1;

  punchInnerHole(inst);
  if (inst.onFirstCopy) { const cb = inst.onFirstCopy; inst.onFirstCopy = undefined; cb(); }
  inst.onAfterFrame?.();
}

function uploadPresetUniforms(): void {
  if (!SHARED) return;
  const { gl, uniforms, preset, glCanvas, dpr } = SHARED;

  // Shared by both stages.
  if (uniforms.u_resolution) gl.uniform2f(uniforms.u_resolution, glCanvas.width, glCanvas.height);
  // Paper's vertex stage divides the world box by this; leaving it at the
  // default 0 collapses the box and the shader renders nothing.
  if (uniforms.u_pixelRatio) gl.uniform1f(uniforms.u_pixelRatio, dpr);

  // Fragment — material.
  if (uniforms.u_colorBack) gl.uniform4fv(uniforms.u_colorBack, hexToRgba(preset.colorBack));
  if (uniforms.u_colorTint) gl.uniform4fv(uniforms.u_colorTint, hexToRgba(preset.colorTint));
  if (uniforms.u_repetition) gl.uniform1f(uniforms.u_repetition, preset.repetition);
  if (uniforms.u_softness) gl.uniform1f(uniforms.u_softness, preset.softness);
  if (uniforms.u_shiftRed) gl.uniform1f(uniforms.u_shiftRed, preset.shiftRed);
  if (uniforms.u_shiftBlue) gl.uniform1f(uniforms.u_shiftBlue, preset.shiftBlue);
  if (uniforms.u_distortion) gl.uniform1f(uniforms.u_distortion, preset.distortion);
  if (uniforms.u_contour) gl.uniform1f(uniforms.u_contour, preset.contour);
  if (uniforms.u_angle) gl.uniform1f(uniforms.u_angle, preset.angle);
  if (uniforms.u_shape) gl.uniform1f(uniforms.u_shape, preset.shape);
  // Procedural only — metal-fx never feeds a logo through the effect.
  if (uniforms.u_isImage) gl.uniform1i(uniforms.u_isImage, 0);
  if (uniforms.u_imageAspectRatio) gl.uniform1f(uniforms.u_imageAspectRatio, 1);

  // Vertex — sizing.
  if (uniforms.u_originX) gl.uniform1f(uniforms.u_originX, preset.originX);
  if (uniforms.u_originY) gl.uniform1f(uniforms.u_originY, preset.originY);
  if (uniforms.u_worldWidth) gl.uniform1f(uniforms.u_worldWidth, preset.worldWidth);
  if (uniforms.u_worldHeight) gl.uniform1f(uniforms.u_worldHeight, preset.worldHeight);
  if (uniforms.u_fit) gl.uniform1f(uniforms.u_fit, preset.fit);
  if (uniforms.u_scale) gl.uniform1f(uniforms.u_scale, preset.scale);
  if (uniforms.u_rotation) gl.uniform1f(uniforms.u_rotation, preset.rotation);
  if (uniforms.u_offsetX) gl.uniform1f(uniforms.u_offsetX, preset.offsetX);
  if (uniforms.u_offsetY) gl.uniform1f(uniforms.u_offsetY, preset.offsetY);

  SHARED.presetDirty = false;
}

function renderSharedFrame(now: number): void {
  if (!SHARED) return;
  const { gl, uniforms, preset, glCanvas } = SHARED;
  const t = ((now - SHARED.startMs - SHARED.pausedMs) / 1000) * preset.speed;

  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (SHARED.presetDirty) uploadPresetUniforms();
  if (uniforms.u_time) gl.uniform1f(uniforms.u_time, t);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  SHARED.frameCount++;
}

let lastFrameMs = 0;

function tick(now: number): void {
  if (!SHARED) return;
  if (SHARED.contextLost) { SHARED.rafId = 0; return; }

  // Loop stays alive while at least one visible instance still has work to do
  // — i.e. it's either unpaused (needs a fresh copy each frame) or paused but
  // hasn't yet painted its first frame (initial-mount-paused case).
  let anyWork = false;
  for (const inst of SHARED.instances) {
    if (inst.visible && (!inst.paused || !inst.everCopied)) { anyWork = true; break; }
  }
  if (!anyWork) { SHARED.rafId = 0; return; }

  SHARED.rafId = requestAnimationFrame(tick);
  if (now - lastFrameMs < FRAME_INTERVAL_MS) return;
  lastFrameMs = now;

  renderSharedFrame(now);

  if (SHARED.useOffscreen) {
    if (SHARED.glowQueue.length > 0) ensureGlowPixels();
    SHARED.frameBitmap?.close();
    SHARED.frameBitmap = (SHARED.glCanvas as OffscreenCanvas).transferToImageBitmap();
  }

  for (const inst of SHARED.instances) {
    if (!inst.visible) continue;
    if (inst.paused && inst.everCopied) continue;
    copyShaderToInstance(inst);
    inst.everCopied = true;
  }

  if (_glowCallback && SHARED.glowQueue.length > 0 && ++SHARED.glowSkip % GLOW_SKIP_FRAMES === 0) {
    const queue = SHARED.glowQueue;
    if (SHARED.glowIdx >= queue.length) SHARED.glowIdx = 0;
    const inst = queue[SHARED.glowIdx];
    // Skip glow frames for paused instances so their halo also freezes
    // (otherwise the catch-light would keep travelling on a frozen ring).
    if (inst.visible && !inst.paused) _glowCallback(inst, now);
    SHARED.glowIdx++;
  }
}

function startSharedLoop(): void {
  if (!SHARED || SHARED.rafId !== 0) return;
  SHARED.rafId = requestAnimationFrame(tick);
}

function stopSharedLoop(): void {
  if (!SHARED) return;
  if (SHARED.rafId !== 0) cancelAnimationFrame(SHARED.rafId);
  SHARED.rafId = 0;
}
