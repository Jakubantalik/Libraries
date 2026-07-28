/**
 * Generic blob-layer SkSL runtime effect — serves the `line` and pulse
 * families (the rotate family has its own conic shader in rotateShader.ts).
 *
 * A layer is: a stack of radial-gradient ellipse "blobs" with up-to-4-stop
 * alpha falloffs, composited source-over (first blob on top, CSS multiple
 * background semantics), inside a geometry mask (border ring band / rounded
 * rect fill / none), optionally windowed by a radial ellipse mask (the line
 * family's traveling window), then the CSS filter color matrix.
 *
 * Blob record: 14 floats —
 *   [rx, ry, cxPx, cyPx, r, g, b, a0, p1, a1, p2, a2, p3, reserved]
 * Alpha falloff over normalized ellipse distance t:
 *   piecewise linear through (0, a0) → (p1, a1) → (p2, a2) → (p3, 0); 0 after.
 * A plain CSS `color → transparent` gradient is a0=a with the linear
 * subdivision p1=1/3, p2=2/3, p3=1.
 */
export const BLOB_FLOATS = 14;
export const MAX_LAYER_BLOBS = 16;

export const BLOB_LAYER_SKSL = `
uniform float2 uSize;        // canvas size (may exceed the element for pulse-outside)
uniform float2 uRectOrigin;  // element rect origin within the canvas
uniform float2 uRectSize;    // element rect size
uniform float uRadius;
uniform float uBorderWidth;
uniform float uGeomKind;     // 0 ring band, 1 rounded-rect fill, 2 none
uniform float uEdgeMaskPx;   // rounded-rect fill only; 0 = none
uniform float uRadial[7];    // [cx, cy, rx, ry, midPos, midAlpha, enabled]
uniform float uBlobs[${MAX_LAYER_BLOBS * BLOB_FLOATS}];
uniform float uBlobCount;
uniform float uCM[9];
uniform float uOpacity;

float roundedRectSDF(float2 p, float2 halfSize, float radius) {
  float2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float4 srcOver(float4 src, float4 dst) {
  return src + dst * (1.0 - src.a);
}

// NOTE: SkSL only allows uniform-array indexing by the induction variable of
// an unrollable loop, so the per-blob alpha falloff is inlined in main below.
float stopAlpha(float t, float a0, float p1, float a1, float p2, float a2, float p3) {
  if (t >= p3) { return 0.0; }
  if (t <= 0.0) { return a0; }
  if (t < p1) { return mix(a0, a1, t / max(p1, 0.0001)); }
  if (t < p2) { return mix(a1, a2, (t - p1) / max(p2 - p1, 0.0001)); }
  return mix(a2, 0.0, (t - p2) / max(p3 - p2, 0.0001));
}

half4 main(float2 position) {
  float2 rectCenter = uRectOrigin + uRectSize * 0.5;
  float2 rel = position - rectCenter;
  int kind = int(uGeomKind);

  // Geometry mask.
  float geom = 1.0;
  float aa = 1.0;
  if (kind != 2) {
    float outerSDF = roundedRectSDF(rel, uRectSize * 0.5, uRadius);
    float outerCov = 1.0 - smoothstep(-aa, 0.0, outerSDF);
    if (kind == 1) {
      geom = outerCov;
    } else {
      float innerRadius = max(uRadius - uBorderWidth, 0.0);
      float innerSDF = roundedRectSDF(rel, uRectSize * 0.5 - uBorderWidth, innerRadius);
      float innerCov = 1.0 - smoothstep(-aa, 0.0, innerSDF);
      geom = outerCov - innerCov;
    }
    if (geom <= 0.0) { return half4(0.0); }
  }

  float mask = 1.0;

  // Edge fade (rounded-rect fill only): union of vertical + horizontal
  // "solid at edges, transparent uEdgeMaskPx inward" gradients.
  if (kind == 1 && uEdgeMaskPx > 0.0) {
    float2 lp = position - uRectOrigin;
    float ev = max(1.0 - lp.y / uEdgeMaskPx,
                   1.0 - (uRectSize.y - lp.y) / uEdgeMaskPx);
    float eh = max(1.0 - lp.x / uEdgeMaskPx,
                   1.0 - (uRectSize.x - lp.x) / uEdgeMaskPx);
    mask *= clamp(max(ev, 0.0) + max(eh, 0.0), 0.0, 1.0);
  }

  // Radial window mask (line family): 1 @0 → midAlpha @midPos → 0 @1.
  if (uRadial[6] > 0.5) {
    float2 c = float2(uRadial[0], uRadial[1]);
    float t = length((position - c) / float2(max(uRadial[2], 0.001), max(uRadial[3], 0.001)));
    float midPos = uRadial[4];
    float midAlpha = uRadial[5];
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
  if (mask <= 0.001) { return half4(0.0); }

  // Blob stack: premultiplied source-over, FIRST blob on top.
  float4 acc = float4(0.0);
  int nBlobs = int(uBlobCount);
  for (int i = ${MAX_LAYER_BLOBS - 1}; i >= 0; i--) {
    if (i < nBlobs) {
      float rx = max(uBlobs[i * ${BLOB_FLOATS} + 0], 0.001);
      float ry = max(uBlobs[i * ${BLOB_FLOATS} + 1], 0.001);
      float2 c = float2(uBlobs[i * ${BLOB_FLOATS} + 2], uBlobs[i * ${BLOB_FLOATS} + 3]);
      float t = length((position - c) / float2(rx, ry));
      float alpha = stopAlpha(
        t,
        uBlobs[i * ${BLOB_FLOATS} + 7],
        uBlobs[i * ${BLOB_FLOATS} + 8],
        uBlobs[i * ${BLOB_FLOATS} + 9],
        uBlobs[i * ${BLOB_FLOATS} + 10],
        uBlobs[i * ${BLOB_FLOATS} + 11],
        uBlobs[i * ${BLOB_FLOATS} + 12]
      );
      if (alpha > 0.0) {
        float3 rgb = float3(
          uBlobs[i * ${BLOB_FLOATS} + 4],
          uBlobs[i * ${BLOB_FLOATS} + 5],
          uBlobs[i * ${BLOB_FLOATS} + 6]
        );
        acc = srcOver(float4(rgb * alpha, alpha), acc);
      }
    }
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

  // Clamped like the CSS \`opacity\` property — see rotateShader.ts.
  float finalA = acc.a * geom * mask * clamp(uOpacity, 0.0, 1.0);
  if (acc.a > 0.0001) {
    return half4(half3(acc.rgb / acc.a * finalA), half(finalA));
  }
  return half4(0.0);
}
`;

/** Encodes a plain 2-stop (color → transparent) blob. */
export function simpleBlob(
  rx: number,
  ry: number,
  cx: number,
  cy: number,
  r: number,
  g: number,
  b: number,
  a: number
): number[] {
  'worklet';
  return [rx, ry, cx, cy, r, g, b, a, 1 / 3, a * (2 / 3), 2 / 3, a / 3, 1, 0];
}

/**
 * Encodes a blob from spec-style stops [{r,g,b,a,pos}...] (2-4 stops, pos
 * ascending, last stop is where alpha reaches its final value; alpha is
 * clamped to 0 beyond the last stop). RGB comes from the first stop (CSS
 * premultiplied interpolation keeps RGB constant for same-color fades).
 */
export function stopsBlob(
  rx: number,
  ry: number,
  cx: number,
  cy: number,
  stops: { r: number; g: number; b: number; a: number; pos: number }[]
): number[] {
  'worklet';
  const first = stops[0];
  const r = first.r / 255;
  const g = first.g / 255;
  const b = first.b / 255;
  const a0 = first.a;
  const s1 = stops[1] ?? { a: 0, pos: 1 };
  const s2 = stops[2] ?? { a: s1.a / 2, pos: (s1.pos + 1) / 2 };
  const s3 = stops[3] ?? { a: 0, pos: Math.max(s2.pos, 1) };
  // Normalize into (p1,a1) (p2,a2) (p3,0).
  if (stops.length === 3) {
    // stops: a0@p0, a1@p1, 0@p2 → subdivide last segment.
    const mid = { a: stops[1].a / 2, pos: (stops[1].pos + stops[2].pos) / 2 };
    return [rx, ry, cx, cy, r, g, b, a0, stops[1].pos, stops[1].a, mid.pos, mid.a, stops[2].pos, 0];
  }
  if (stops.length === 4) {
    return [rx, ry, cx, cy, r, g, b, a0, s1.pos, s1.a, s2.pos, s2.a, s3.pos, 0];
  }
  // 2 stops: linear a0 → 0 at last pos.
  const end = s1.pos;
  return [rx, ry, cx, cy, r, g, b, a0, end / 3, a0 * (2 / 3), (2 * end) / 3, a0 / 3, end, 0];
}

/** Disabled radial-mask uniform. */
export const NO_RADIAL: number[] = [0, 0, 1, 1, 0.5, 0.5, 0];
