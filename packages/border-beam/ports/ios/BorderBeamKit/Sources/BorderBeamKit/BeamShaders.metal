#include <metal_stdlib>
using namespace metal;

// BorderBeamKit — rotate-family layer shader.
//
// Reproduces the web library's layer construction (see src/styles.ts in the
// repo root): a stack of CSS radial-gradient ellipse "blobs" composited
// source-over, an optional conic gradient on top (the white beam highlight or
// the bloom ring), masked by a rotating conic beam window and the rounded-rect
// border-ring geometry, then run through the CSS filter chain
// (hue-rotate → brightness → saturate) as a precomposed 3x3 color matrix.
//
// CSS semantics intentionally mirrored:
// - Explicit-size radial gradients: the two lengths are the ellipse RADII.
// - `color → transparent` gradients interpolate premultiplied: RGB constant,
//   alpha falls linearly to 0 at the ellipse edge.
// - Multiple backgrounds composite source-over with the FIRST layer on top.
// - conic-gradient(from A) places stop 0 at angle A, clockwise from 12 o'clock.

// ── Helpers ──────────────────────────────────────────────────────────────────

static float roundedRectSDF(float2 p, float2 halfSize, float radius) {
    float2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// Piecewise-linear alpha lookup. `stops` is [pos, alpha] pairs, pos in 0..1.
static float stopsAlpha(device const float *stops, int floatCount, float t) {
    int n = floatCount / 2;
    if (n == 0) return 1.0;
    if (t <= stops[0]) return stops[1];
    for (int i = 1; i < n; i++) {
        float p0 = stops[2 * (i - 1)];
        float a0 = stops[2 * (i - 1) + 1];
        float p1 = stops[2 * i];
        float a1 = stops[2 * i + 1];
        if (t <= p1) {
            float f = (p1 > p0) ? (t - p0) / (p1 - p0) : 0.0;
            return mix(a0, a1, f);
        }
    }
    return stops[2 * (n - 1) + 1];
}

// CSS conic angle fraction (0 at top, clockwise) for a y-down coordinate space.
static float conicFraction(float2 p, float2 center) {
    float2 d = p - center;
    float theta = atan2(d.x, -d.y);              // 0 up, +clockwise
    return fract(theta / (2.0 * M_PI_F) + 1.0);
}

// src-over composite of premultiplied colors.
static float4 srcOver(float4 src, float4 dst) {
    return src + dst * (1.0 - src.a);
}

// Arc-length parametrization of a rounded-rect border. Returns
// float3(s, d, P): s = clockwise arc length from the top-center, d = distance
// inside the border (negative outside), P = total perimeter. Inside the
// rect's interior "cross" (far from every edge) s snaps to the nearest edge's
// projection; callers only evaluate border-hugging fields there, so the far
// interior never becomes visible.
static float3 borderPathCoord(float2 rel, float2 halfSize, float r) {
    float ex = max(halfSize.x - r, 0.0);
    float ey = max(halfSize.y - r, 0.0);
    float arc = 0.5 * M_PI_F * r;
    float P = 4.0 * ex + 4.0 * ey + 4.0 * arc;
    float halfPi = 0.5 * M_PI_F;
    float x = rel.x, y = rel.y;
    float ax = fabs(x), ay = fabs(y);

    if (ax > ex && ay > ey) {
        // Corner arc region: measure the angle around the arc center.
        float2 k = float2(copysign(ex, x), copysign(ey, y));
        float2 v = rel - k;
        float d = r - length(v);
        float a, base;
        if (x >= 0.0 && y < 0.0)  { a = atan2(v.x, -v.y);  base = ex; }
        else if (x >= 0.0)        { a = atan2(v.y, v.x);   base = ex + arc + 2.0 * ey; }
        else if (y >= 0.0)        { a = atan2(-v.x, v.y);  base = 3.0 * ex + 2.0 * arc + 2.0 * ey; }
        else                      { a = atan2(-v.y, -v.x); base = 3.0 * ex + 3.0 * arc + 4.0 * ey; }
        return float3(base + r * clamp(a, 0.0, halfPi), d, P);
    }

    bool vertBand;
    if (ax > ex)      vertBand = true;
    else if (ay > ey) vertBand = false;
    else              vertBand = (halfSize.x - ax) < (halfSize.y - ay);

    if (vertBand) {
        if (x >= 0.0) return float3(ex + arc + (y + ey), halfSize.x - x, P);
        return float3(3.0 * ex + 3.0 * arc + 2.0 * ey + (ey - y), x + halfSize.x, P);
    }
    if (y < 0.0) {
        return float3((x >= 0.0) ? x : P + x, y + halfSize.y, P);
    }
    return float3(ex + 2.0 * arc + 2.0 * ey + (ex - x), halfSize.y - y, P);
}

// ── Rotate-family layer ──────────────────────────────────────────────────────
//
// layerKind: 0 = stroke ring (::after), 1 = inner glow (::before),
//            2 = bloom ring ([data-beam-bloom], blurred by SwiftUI).
//
// blobs: 8 floats each — [radiusX, radiusY, centerXfrac, centerYfrac, r, g, b, a]
//        (center fractions are of the full element size; may be <0 or >1).
// bg:    conic gradient stops layered ON TOP of the blobs ([pos, alpha] pairs).
// mask:  conic beam-window stops; empty ⇒ no conic mask.
// cm:    9 floats, row-major 3x3 color matrix (hue-rotate/brightness/saturate).

[[ stitchable ]] half4 beamRotateLayer(
    float2 position,
    half4 inColor,
    float2 size,
    float beamAngle,        // fraction of a full turn, 0..1
    float cornerRadius,
    float borderWidth,
    float layerKind,
    float edgeMaskPx,       // inner layer edge fade width; 0 ⇒ none
    device const float *blobs, int blobCount,
    device const float *bg, int bgCount,
    float bgIsBlack,
    device const float *maskStops, int maskCount,
    device const float *cm, int cmCount,
    float opacity,
    half4 shadowColor,
    float shadowBlur
) {
    float2 center = size * 0.5;
    float2 rel = position - center;
    int kind = int(layerKind);

    // Geometry mask: ring band for stroke/bloom, full rounded rect for inner.
    float outerSDF = roundedRectSDF(rel, center, cornerRadius);
    float aa = 1.0;
    float geom;
    float outerCov = 1.0 - smoothstep(-aa, 0.0, outerSDF);
    if (kind == 1) {
        geom = outerCov;
    } else {
        float innerRadius = max(cornerRadius - borderWidth, 0.0);
        float innerSDF = roundedRectSDF(rel, center - borderWidth, innerRadius);
        float innerCov = 1.0 - smoothstep(-aa, 0.0, innerSDF);
        geom = outerCov - innerCov;   // band between outer and inner rects
    }
    if (geom <= 0.0) return half4(0.0);

    // Conic beam-window mask, rotating with beamAngle.
    float mask = 1.0;
    if (maskCount > 0) {
        float t = fract(conicFraction(position, center) - beamAngle);
        mask = stopsAlpha(maskStops, maskCount, t);
    }

    // Inner layer: edge fade — union (mask add) of vertical + horizontal
    // "solid at edges, transparent `edgeMaskPx` inward" linear gradients.
    if (kind == 1 && edgeMaskPx > 0.0) {
        float ev = max(1.0 - position.y / edgeMaskPx,
                       1.0 - (size.y - position.y) / edgeMaskPx);
        float eh = max(1.0 - position.x / edgeMaskPx,
                       1.0 - (size.x - position.x) / edgeMaskPx);
        float edge = clamp(max(ev, 0.0) + max(eh, 0.0), 0.0, 1.0);
        mask *= edge;
    }
    if (mask <= 0.001) return half4(0.0);

    // Blob stack (premultiplied, first blob on top ⇒ composite last-to-first).
    float4 acc = float4(0.0);
    int nBlobs = blobCount / 8;
    for (int i = nBlobs - 1; i >= 0; i--) {
        device const float *e = blobs + i * 8;
        float2 radii = float2(max(e[0], 0.001), max(e[1], 0.001));
        float2 c = float2(e[2], e[3]) * size;
        float d = length((position - c) / radii);
        float alpha = e[7] * clamp(1.0 - d, 0.0, 1.0);
        if (alpha <= 0.0) continue;
        float4 src = float4(float3(e[4], e[5], e[6]) * alpha, alpha);
        acc = srcOver(src, acc);
    }

    // Conic gradient on top (white beam highlight, or the bloom ring pattern).
    if (bgCount > 0) {
        float t = fract(conicFraction(position, center) - beamAngle);
        float a = stopsAlpha(bg, bgCount, t);
        float3 rgb = (bgIsBlack > 0.5) ? float3(0.0) : float3(1.0);
        acc = srcOver(float4(rgb * a, a), acc);
    }

    // Inner inset shadow: `inset 0 0 <blur> 1px <color>` approximation —
    // strongest at the border, fading `shadowBlur` px inward.
    if (kind == 1 && shadowColor.a > 0.0 && shadowBlur > 0.0) {
        float depth = -outerSDF;   // distance inside the rounded rect
        float fall = clamp(1.0 - depth / (shadowBlur + 1.0), 0.0, 1.0);
        float a = float(shadowColor.a) * fall * fall;
        float4 sh = float4(float3(shadowColor.rgb) * a, a);
        acc = srcOver(sh, acc);
    }

    // CSS filter chain as a 3x3 matrix on unpremultiplied RGB.
    if (acc.a > 0.0001 && cmCount >= 9) {
        float3 rgb = acc.rgb / acc.a;
        float3 outRGB = float3(
            dot(float3(cm[0], cm[1], cm[2]), rgb),
            dot(float3(cm[3], cm[4], cm[5]), rgb),
            dot(float3(cm[6], cm[7], cm[8]), rgb)
        );
        acc.rgb = clamp(outRGB, 0.0, 1.0) * acc.a;
    }

    // CSS clamps the `opacity` property to [0,1]; several presets exceed 1
    // (e.g. line/dark stroke 1.14). Without this the premultiplied alpha goes
    // above 1 and compositing breaks down.
    float finalA = acc.a * geom * mask * clamp(opacity, 0.0, 1.0);
    if (acc.a > 0.0001) {
        return half4(half3(acc.rgb / acc.a) * finalA, finalA);
    }
    return half4(0.0);
}

// ── Generic blob layer (line + pulse families) ───────────────────────────────
//
// Mirrors border-beam-native's blobShader.ts (keep in sync). A stack of
// radial-gradient blobs with up-to-4-stop alpha falloffs, source-over
// composited (first on top), inside a geometry mask (0 = border ring band,
// 1 = rounded-rect fill, 2 = none), optionally windowed by a radial ellipse
// mask (line family), then the CSS filter color matrix.
//
// Blob record: 14 floats —
//   [rx, ry, cxPx, cyPx, r, g, b, a0, p1, a1, p2, a2, p3, reserved]
// Alpha over normalized ellipse distance t: piecewise linear through
// (0,a0) → (p1,a1) → (p2,a2) → (p3,0); 0 after p3.
// radial: [cx, cy, rx, ry, midPos, midAlpha, enabled] — 1 @0 → midAlpha
// @midPos → 0 @1.

static float stopAlpha(float t, float a0, float p1, float a1, float p2, float a2, float p3) {
    if (t >= p3) return 0.0;
    if (t <= 0.0) return a0;
    if (t < p1) return mix(a0, a1, t / max(p1, 0.0001));
    if (t < p2) return mix(a1, a2, (t - p1) / max(p2 - p1, 0.0001));
    return mix(a2, 0.0, (t - p2) / max(p3 - p2, 0.0001));
}

[[ stitchable ]] half4 beamBlobLayer(
    float2 position,
    half4 inColor,
    float2 rectOrigin,
    float2 rectSize,
    float radius,
    float borderWidth,
    float geomKind,
    float edgeMaskPx,
    float wrapCorners,
    device const float *radial, int radialCount,
    device const float *blobs, int blobCount,
    device const float *cm, int cmCount,
    float opacity
) {
    float2 rectCenter = rectOrigin + rectSize * 0.5;
    float2 rel = position - rectCenter;
    int kind = int(geomKind);
    bool wrap = wrapCorners > 0.5;

    // Geometry mask.
    float geom = 1.0;
    float aa = 1.0;
    if (kind != 2) {
        float outerSDF = roundedRectSDF(rel, rectSize * 0.5, radius);
        float outerCov = 1.0 - smoothstep(-aa, 0.0, outerSDF);
        if (kind == 1) {
            geom = outerCov;
        } else {
            float innerRadius = max(radius - borderWidth, 0.0);
            float innerSDF = roundedRectSDF(rel, rectSize * 0.5 - borderWidth, innerRadius);
            float innerCov = 1.0 - smoothstep(-aa, 0.0, innerSDF);
            geom = outerCov - innerCov;
        }
        if (geom <= 0.0) return half4(0.0);
    }

    // Border-path coordinates of this pixel (wrap mode only): x = clockwise
    // arc length along the border, y = distance inside it, z = perimeter.
    float3 pathP = float3(0.0);
    if (wrap) {
        pathP = borderPathCoord(rel, rectSize * 0.5, radius);
    }

    float mask = 1.0;

    // Edge fade (rounded-rect fill only). In wrap mode the fade follows the
    // border's inside distance, so its isolines bend around the corner arcs
    // instead of forming the square union of two straight gradients.
    if (kind == 1 && edgeMaskPx > 0.0) {
        if (wrap) {
            mask *= clamp(1.0 - pathP.y / edgeMaskPx, 0.0, 1.0);
        } else {
            float2 lp = position - rectOrigin;
            float ev = max(1.0 - lp.y / edgeMaskPx, 1.0 - (rectSize.y - lp.y) / edgeMaskPx);
            float eh = max(1.0 - lp.x / edgeMaskPx, 1.0 - (rectSize.x - lp.x) / edgeMaskPx);
            mask *= clamp(max(ev, 0.0) + max(eh, 0.0), 0.0, 1.0);
        }
    }

    // Radial window mask (line family).
    if (radialCount >= 7 && radial[6] > 0.5) {
        float2 c = float2(radial[0], radial[1]);
        float t = length((position - c) / float2(max(radial[2], 0.001), max(radial[3], 0.001)));
        float midPos = radial[4];
        float midAlpha = radial[5];
        float m;
        if (t >= 1.0) {
            m = 0.0;
        } else if (t < midPos) {
            m = mix(1.0, midAlpha, t / max(midPos, 0.0001));
        } else {
            m = mix(midAlpha, 0.0, (t - midPos) / max(1.0 - midPos, 0.0001));
        }
        mask *= m;
    }
    if (mask <= 0.001) return half4(0.0);

    // Blob stack: premultiplied source-over, FIRST blob on top.
    //
    // Wrap mode (pulse-inner glow): blobs are evaluated in border-path space —
    // tangential distance measured along the border (through the corner arcs)
    // and normal distance measured inward — so the glow bends with the corner
    // radius and neighbouring edge blobs blend along the path instead of
    // overlapping as straight-edged ellipses. Along straight edges this is
    // identical to the planar evaluation. e[13] carries the blob's tangential
    // axis (1 = the blob hugs a left/right edge, its ry runs along the border).
    float4 acc = float4(0.0);
    int nBlobs = blobCount / 14;
    for (int i = nBlobs - 1; i >= 0; i--) {
        device const float *e = blobs + i * 14;
        float rx = max(e[0], 0.001);
        float ry = max(e[1], 0.001);
        float2 c = float2(e[2], e[3]);
        float t;
        if (wrap) {
            float3 pathC = borderPathCoord(c - rectCenter, rectSize * 0.5, radius);
            float ds = pathP.x - pathC.x;
            ds -= pathP.z * rint(ds / max(pathP.z, 0.0001));
            float dd = pathP.y - pathC.y;
            bool vertical = e[13] > 0.5;
            float rT = vertical ? ry : rx;
            float rN = vertical ? rx : ry;
            t = length(float2(ds / rT, dd / rN));
        } else {
            t = length((position - c) / float2(rx, ry));
        }
        float alpha = stopAlpha(t, e[7], e[8], e[9], e[10], e[11], e[12]);
        if (alpha <= 0.0) continue;
        acc = srcOver(float4(float3(e[4], e[5], e[6]) * alpha, alpha), acc);
    }

    // CSS filter chain.
    if (acc.a > 0.0001 && cmCount >= 9) {
        float3 rgb = acc.rgb / acc.a;
        float3 outRGB = float3(
            dot(float3(cm[0], cm[1], cm[2]), rgb),
            dot(float3(cm[3], cm[4], cm[5]), rgb),
            dot(float3(cm[6], cm[7], cm[8]), rgb)
        );
        acc.rgb = clamp(outRGB, 0.0, 1.0) * acc.a;
    }

    // Clamped like the CSS `opacity` property — see beamRotateLayer.
    float finalA = acc.a * geom * mask * clamp(opacity, 0.0, 1.0);
    if (acc.a > 0.0001) {
        return half4(half3(acc.rgb / acc.a) * finalA, finalA);
    }
    return half4(0.0);
}
