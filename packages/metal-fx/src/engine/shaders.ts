/**
 * Vertex + fragment shader for the metal-fx effect.
 *
 * Source-of-truth: Paper Shaders' `liquidMetal`, consumed unmodified from
 * `@paper-design/shaders` so the material stays byte-identical to what the
 * Paper editor previews and updates come in via npm.
 *
 * Paper's shaders are GLSL ES 3.00 / WebGL2 (`#version 300 es`, `out vec4
 * fragColor`), which is why the shared renderer asks for a `webgl2` context.
 * The fragment stage reads varyings (`v_objectUV`, `v_responsiveUV`,
 * `v_responsiveBoxGivenSize`, `v_imageUV`) produced by Paper's own vertex
 * shader, so the pair has to travel together — a bare full-screen-quad vertex
 * stage will link but render nothing.
 *
 * The vertex source is vendored below rather than imported: `@paper-design/
 * shaders` exposes it only through `ShaderMount`, which owns its own canvas
 * and RAF loop and would bypass this library's shared-renderer architecture
 * (one GL context feeding every instance). Copied verbatim from
 * paper-design/shaders `packages/shaders/src/vertex-shader.ts` @ 0.0.80,
 * Apache-2.0 — see NOTICE.
 *
 * IMPORTANT: `#version` must be the first characters of the source string.
 * Neither template literal below may start with a newline.
 *
 * Fragment uniforms (Paper's liquidMetal):
 *   u_resolution      vec2  — destination pixel buffer (DPR-scaled)
 *   u_time            float — seconds since boot, JS-side multiplied by speed
 *   u_pixelRatio      float — device pixel ratio the buffer was sized at
 *   u_colorBack       vec4  — backdrop RGBA, composited under the material
 *   u_colorTint       vec4  — tint RGBA, applied as color-burn (a = amount)
 *   u_repetition      float — stripe density (1..10)
 *   u_softness        float — stripe transition blur (0..1)
 *   u_shiftRed        float — R-channel dispersion (-1..1)
 *   u_shiftBlue       float — B-channel dispersion (-1..1)
 *   u_distortion      float — simplex-noise warp over the stripes (0..1)
 *   u_contour         float — edge-following strength (0..1)
 *   u_angle           float — pattern drift direction, degrees (0..360)
 *   u_shape           float — 0 none / 1 circle / 2 daisy / 3 diamond / 4 metaballs
 *   u_isImage         bool  — image-mask mode; always false here
 *   u_image           sampler2D — unused at u_isImage=false, 1×1 dummy bound
 *
 * Sizing uniforms consumed by the vertex stage: u_originX, u_originY,
 * u_worldWidth, u_worldHeight, u_fit, u_scale, u_rotation, u_offsetX,
 * u_offsetY, u_imageAspectRatio.
 *
 * Note the material itself is fixed: Paper hardcodes the stripe endpoints to
 * near-white and near-black, so all color comes from u_colorTint (burn) and
 * u_colorBack. There is no multi-stop palette to drive.
 */
import { liquidMetalFragmentShader } from '@paper-design/shaders';

/** Paper's sizing vertex stage. Vendored verbatim — see file header. */
export const VERT_SHADER_SRC = /* glsl */ `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_imageAspectRatio;
uniform float u_originX;
uniform float u_originY;
uniform float u_worldWidth;
uniform float u_worldHeight;
uniform float u_fit;
uniform float u_scale;
uniform float u_rotation;
uniform float u_offsetX;
uniform float u_offsetY;

out vec2 v_objectUV;
out vec2 v_objectBoxSize;
out vec2 v_responsiveUV;
out vec2 v_responsiveBoxGivenSize;
out vec2 v_patternUV;
out vec2 v_patternBoxSize;
out vec2 v_imageUV;

vec3 getBoxSize(float boxRatio, vec2 givenBoxSize) {
  vec2 box = vec2(0.);
  // fit = none
  box.x = boxRatio * min(givenBoxSize.x / boxRatio, givenBoxSize.y);
  float noFitBoxWidth = box.x;
  if (u_fit == 1.) { // fit = contain
    box.x = boxRatio * min(u_resolution.x / boxRatio, u_resolution.y);
  } else if (u_fit == 2.) { // fit = cover
    box.x = boxRatio * max(u_resolution.x / boxRatio, u_resolution.y);
  }
  box.y = box.x / boxRatio;
  return vec3(box, noFitBoxWidth);
}

void main() {
  gl_Position = a_position;

  vec2 uv = gl_Position.xy * .5;
  vec2 boxOrigin = vec2(.5 - u_originX, u_originY - .5);
  vec2 givenBoxSize = vec2(u_worldWidth, u_worldHeight);
  givenBoxSize = max(givenBoxSize, vec2(1.)) * u_pixelRatio;
  float r = u_rotation * 3.14159265358979323846 / 180.;
  mat2 graphicRotation = mat2(cos(r), sin(r), -sin(r), cos(r));
  vec2 graphicOffset = vec2(-u_offsetX, u_offsetY);


  // ===================================================

  float fixedRatio = 1.;
  vec2 fixedRatioBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );

  v_objectBoxSize = getBoxSize(fixedRatio, fixedRatioBoxGivenSize).xy;
  vec2 objectWorldScale = u_resolution.xy / v_objectBoxSize;

  v_objectUV = uv;
  v_objectUV *= objectWorldScale;
  v_objectUV += boxOrigin * (objectWorldScale - 1.);
  v_objectUV += graphicOffset;
  v_objectUV /= u_scale;
  v_objectUV = graphicRotation * v_objectUV;

  // ===================================================

  v_responsiveBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  float responsiveRatio = v_responsiveBoxGivenSize.x / v_responsiveBoxGivenSize.y;
  vec2 responsiveBoxSize = getBoxSize(responsiveRatio, v_responsiveBoxGivenSize).xy;
  vec2 responsiveBoxScale = u_resolution.xy / responsiveBoxSize;

  v_responsiveUV = uv;
  v_responsiveUV *= responsiveBoxScale;
  v_responsiveUV += boxOrigin * (responsiveBoxScale - 1.);
  v_responsiveUV += graphicOffset;
  v_responsiveUV /= u_scale;
  v_responsiveUV.x *= responsiveRatio;
  v_responsiveUV = graphicRotation * v_responsiveUV;
  v_responsiveUV.x /= responsiveRatio;

  // ===================================================

  float patternBoxRatio = givenBoxSize.x / givenBoxSize.y;
  vec2 patternBoxGivenSize = vec2(
  (u_worldWidth == 0.) ? u_resolution.x : givenBoxSize.x,
  (u_worldHeight == 0.) ? u_resolution.y : givenBoxSize.y
  );
  patternBoxRatio = patternBoxGivenSize.x / patternBoxGivenSize.y;

  vec3 boxSizeData = getBoxSize(patternBoxRatio, patternBoxGivenSize);
  v_patternBoxSize = boxSizeData.xy;
  float patternBoxNoFitBoxWidth = boxSizeData.z;
  vec2 patternBoxScale = u_resolution.xy / v_patternBoxSize;

  v_patternUV = uv;
  v_patternUV += graphicOffset / patternBoxScale;
  v_patternUV += boxOrigin;
  v_patternUV -= boxOrigin / patternBoxScale;
  v_patternUV *= u_resolution.xy;
  v_patternUV /= u_pixelRatio;
  if (u_fit > 0.) {
    v_patternUV *= (patternBoxNoFitBoxWidth / v_patternBoxSize.x);
  }
  v_patternUV /= u_scale;
  v_patternUV = graphicRotation * v_patternUV;
  v_patternUV += boxOrigin / patternBoxScale;
  v_patternUV -= boxOrigin;
  // x100 is a default multiplier between vertex and fragmant shaders
  // we use it to avoid UV presision issues
  v_patternUV *= .01;

  // ===================================================

  vec2 imageBoxSize;
  if (u_fit == 1.) { // contain
    imageBoxSize.x = min(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else if (u_fit == 2.) { // cover
    imageBoxSize.x = max(u_resolution.x / u_imageAspectRatio, u_resolution.y) * u_imageAspectRatio;
  } else {
    imageBoxSize.x = min(10.0, 10.0 / u_imageAspectRatio * u_imageAspectRatio);
  }
  imageBoxSize.y = imageBoxSize.x / u_imageAspectRatio;
  vec2 imageBoxScale = u_resolution.xy / imageBoxSize;

  v_imageUV = uv;
  v_imageUV *= imageBoxScale;
  v_imageUV += boxOrigin * (imageBoxScale - 1.);
  v_imageUV += graphicOffset;
  v_imageUV /= u_scale;
  v_imageUV.x *= u_imageAspectRatio;
  v_imageUV = graphicRotation * v_imageUV;
  v_imageUV.x /= u_imageAspectRatio;

  v_imageUV += .5;
  v_imageUV.y = 1. - v_imageUV.y;
}`;

/** Paper's liquidMetal fragment stage, unmodified. */
export const FRAG_SHADER_SRC: string = liquidMetalFragmentShader;

/** Compile a single shader stage. Throws with the GL info log on failure. */
export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('metal-fx: gl.createShader returned null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`metal-fx: shader compile failed: ${info ?? '(no info log)'}`);
  }
  return shader;
}

/** Link a vertex + fragment shader pair into a complete program. */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('metal-fx: gl.createProgram returned null');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`metal-fx: program link failed: ${info ?? '(no info log)'}`);
  }
  return program;
}
