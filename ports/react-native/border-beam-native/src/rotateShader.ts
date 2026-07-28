/**
 * SkSL runtime effect for the rotate-family beam layers — a direct translation
 * of BorderBeamKit's `BeamShaders.metal` (keep both in sync; see that file for
 * the CSS semantics being mirrored).
 *
 * Uniform arrays are fixed-size in SkSL; counts select the used prefix.
 * Blob layout: 8 floats each — [rx, ry, cxFrac, cyFrac, r, g, b, a].
 * Stop arrays: [pos 0..1, alpha] pairs.
 */
export const MAX_BLOBS = 12;
export const MAX_BG_STOPS = 16;
export const MAX_MASK_STOPS = 12;

export const ROTATE_LAYER_SKSL = `
const float PI = 3.14159265358979;

uniform float2 uSize;
uniform float uAngle;        // beam angle, fraction of a full turn 0..1
uniform float uRadius;
uniform float uBorderWidth;
uniform float uKind;         // 0 stroke ring, 1 inner glow, 2 bloom ring
uniform float uEdgeMaskPx;   // inner-layer edge fade; 0 = none
uniform float uBlobs[${MAX_BLOBS * 8}];
uniform float uBlobCount;
uniform float uBg[${MAX_BG_STOPS * 2}];
uniform float uBgCount;      // float count (pairs * 2)
uniform float uBgIsBlack;
uniform float uMask[${MAX_MASK_STOPS * 2}];
uniform float uMaskCount;    // float count (pairs * 2)
uniform float uCM[9];        // row-major 3x3 color matrix
uniform float uOpacity;
uniform float4 uShadowColor;
uniform float uShadowBlur;

float roundedRectSDF(float2 p, float2 halfSize, float radius) {
  float2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float conicFraction(float2 p, float2 center) {
  float2 d = p - center;
  float theta = atan(d.x, -d.y);   // 0 at top, +clockwise (y-down coords)
  return fract(theta / (2.0 * PI) + 1.0);
}

float bgStopsAlpha(float t) {
  int n = int(uBgCount) * 1 / 2;
  if (n == 0) { return 1.0; }
  float result = uBg[1];
  for (int i = 1; i < ${MAX_BG_STOPS}; i++) {
    if (i < n) {
      float p0 = uBg[2 * (i - 1)];
      float a0 = uBg[2 * (i - 1) + 1];
      float p1 = uBg[2 * i];
      float a1 = uBg[2 * i + 1];
      if (t > p0) {
        float f = p1 > p0 ? clamp((t - p0) / (p1 - p0), 0.0, 1.0) : 1.0;
        result = mix(a0, a1, f);
      }
    }
  }
  return result;
}

float maskStopsAlpha(float t) {
  int n = int(uMaskCount) * 1 / 2;
  if (n == 0) { return 1.0; }
  float result = uMask[1];
  for (int i = 1; i < ${MAX_MASK_STOPS}; i++) {
    if (i < n) {
      float p0 = uMask[2 * (i - 1)];
      float a0 = uMask[2 * (i - 1) + 1];
      float p1 = uMask[2 * i];
      float a1 = uMask[2 * i + 1];
      if (t > p0) {
        float f = p1 > p0 ? clamp((t - p0) / (p1 - p0), 0.0, 1.0) : 1.0;
        result = mix(a0, a1, f);
      }
    }
  }
  return result;
}

float4 srcOver(float4 src, float4 dst) {
  return src + dst * (1.0 - src.a);
}

half4 main(float2 position) {
  float2 center = uSize * 0.5;
  float2 rel = position - center;
  int kind = int(uKind);

  // Geometry: ring band for stroke/bloom, full rounded rect for inner.
  float outerSDF = roundedRectSDF(rel, center, uRadius);
  float aa = 1.0;
  float outerCov = 1.0 - smoothstep(-aa, 0.0, outerSDF);
  float geom;
  if (kind == 1) {
    geom = outerCov;
  } else {
    float innerRadius = max(uRadius - uBorderWidth, 0.0);
    float innerSDF = roundedRectSDF(rel, center - uBorderWidth, innerRadius);
    float innerCov = 1.0 - smoothstep(-aa, 0.0, innerSDF);
    geom = outerCov - innerCov;
  }
  if (geom <= 0.0) { return half4(0.0); }

  // Rotating conic beam-window mask.
  float mask = 1.0;
  if (uMaskCount > 0.5) {
    float t = fract(conicFraction(position, center) - uAngle);
    mask = maskStopsAlpha(t);
  }

  // Inner layer: edge fade (union of vertical + horizontal edge gradients).
  if (kind == 1 && uEdgeMaskPx > 0.0) {
    float ev = max(1.0 - position.y / uEdgeMaskPx,
                   1.0 - (uSize.y - position.y) / uEdgeMaskPx);
    float eh = max(1.0 - position.x / uEdgeMaskPx,
                   1.0 - (uSize.x - position.x) / uEdgeMaskPx);
    float edge = clamp(max(ev, 0.0) + max(eh, 0.0), 0.0, 1.0);
    mask *= edge;
  }
  if (mask <= 0.001) { return half4(0.0); }

  // Blob stack: premultiplied source-over, FIRST blob on top.
  float4 acc = float4(0.0);
  int nBlobs = int(uBlobCount);
  for (int i = ${MAX_BLOBS - 1}; i >= 0; i--) {
    if (i < nBlobs) {
      float rx = max(uBlobs[i * 8 + 0], 0.001);
      float ry = max(uBlobs[i * 8 + 1], 0.001);
      float2 c = float2(uBlobs[i * 8 + 2], uBlobs[i * 8 + 3]) * uSize;
      float d = length((position - c) / float2(rx, ry));
      float alpha = uBlobs[i * 8 + 7] * clamp(1.0 - d, 0.0, 1.0);
      if (alpha > 0.0) {
        float3 rgb = float3(uBlobs[i * 8 + 4], uBlobs[i * 8 + 5], uBlobs[i * 8 + 6]);
        acc = srcOver(float4(rgb * alpha, alpha), acc);
      }
    }
  }

  // Conic gradient on top (white beam highlight / bloom ring pattern).
  if (uBgCount > 0.5) {
    float t = fract(conicFraction(position, center) - uAngle);
    float a = bgStopsAlpha(t);
    float3 rgb = uBgIsBlack > 0.5 ? float3(0.0) : float3(1.0);
    acc = srcOver(float4(rgb * a, a), acc);
  }

  // Inner inset shadow approximation.
  if (kind == 1 && uShadowColor.a > 0.0 && uShadowBlur > 0.0) {
    float depth = -outerSDF;
    float fall = clamp(1.0 - depth / (uShadowBlur + 1.0), 0.0, 1.0);
    float a = uShadowColor.a * fall * fall;
    acc = srcOver(float4(uShadowColor.rgb * a, a), acc);
  }

  // CSS filter chain (3x3 matrix on unpremultiplied RGB).
  if (acc.a > 0.0001) {
    float3 rgb = acc.rgb / acc.a;
    float3 outRGB = float3(
      dot(float3(uCM[0], uCM[1], uCM[2]), rgb),
      dot(float3(uCM[3], uCM[4], uCM[5]), rgb),
      dot(float3(uCM[6], uCM[7], uCM[8]), rgb)
    );
    acc.rgb = clamp(outRGB, 0.0, 1.0) * acc.a;
  }

  // CSS clamps the \`opacity\` property to [0,1]; several presets exceed 1
  // (e.g. line/dark stroke 1.14). Without this the premultiplied alpha goes
  // above 1 and compositing breaks down.
  float finalA = acc.a * geom * mask * clamp(uOpacity, 0.0, 1.0);
  if (acc.a > 0.0001) {
    return half4(half3(acc.rgb / acc.a * finalA), half(finalA));
  }
  return half4(0.0);
}
`;

/** Pads a float array to a fixed uniform length. */
export function padTo(values: number[], length: number): number[] {
  if (values.length >= length) return values.slice(0, length);
  return values.concat(new Array(length - values.length).fill(0));
}
