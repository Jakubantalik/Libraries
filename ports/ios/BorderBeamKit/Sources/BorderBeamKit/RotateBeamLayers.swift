import SwiftUI

/// Resolved, parse-once configuration for the rotate family (`sm` / `md`).
/// Built when props/theme change; the per-frame closure only varies the beam
/// angle and hue-shift matrix.
struct RotateBeamConfig {
    let size: BeamSize
    let variant: BeamColorVariant
    let theme: String
    let staticColors: Bool
    let duration: Double
    let borderRadius: Double?
    let brightness: Double?
    let saturation: Double?
    let hueRange: Double
    let strength: Double

    let spec = BeamSpec.shared

    var isDark: Bool { theme == "dark" }

    var themeConfig: BeamSpec.ThemeColors {
        spec.sizeThemePresets[size.rawValue]![theme]!
    }

    var sizeConfig: BeamSpec.SizeConfig {
        spec.sizePresets[size.rawValue]!
    }

    var radius: Double { borderRadius ?? sizeConfig.borderRadius }
    var borderWidth: Double { sizeConfig.borderWidth }
    var monoMul: Double { variant == .mono ? spec.defaults.monoOpacityMultiplier : 1 }
    var finalBrightness: Double { brightness ?? themeConfig.brightness ?? spec.defaults.brightnessFallback }
    var finalSaturation: Double { saturation ?? themeConfig.saturation }

    // ── Blob arrays (8 floats per blob: rx, ry, cxFrac, cyFrac, r, g, b, a) ──

    private func blobFloats(_ blobs: [BeamSpec.GradientBlob], sizeScale: Double = 1, alphaOverride: Double? = nil) -> [Float] {
        blobs.flatMap { blob -> [Float] in
            guard let color = BeamRGBA(css: blob.color) else { return [] }
            let pos = parsePercentPair(blob.pos)
            let radii = parsePixelPair(blob.size)
            // Web derivation rounds the scaled sizes to whole px.
            let rx = sizeScale == 1 ? radii.width : (radii.width * sizeScale).rounded()
            let ry = sizeScale == 1 ? radii.height : (radii.height * sizeScale).rounded()
            return [
                Float(rx), Float(ry),
                Float(pos.x), Float(pos.y),
                Float(color.r), Float(color.g), Float(color.b),
                Float(alphaOverride ?? color.a),
            ]
        }
    }

    /// Stroke-layer blobs (::after color gradients).
    var strokeBlobs: [Float] {
        switch size {
        case .sm:
            return blobFloats(spec.palettes.small[variant.rawValue]!.border)
        default:
            return blobFloats(spec.palettes.border[variant.rawValue]!.border)
        }
    }

    /// Inner-layer blobs (::before). `sm` has a dedicated palette; `md` derives
    /// from the border palette (size × 0.9, alpha 0.45 / 0.225 for mono).
    var innerBlobs: [Float] {
        switch size {
        case .sm:
            return blobFloats(spec.palettes.small[variant.rawValue]!.inner)
        default:
            let d = spec.rotate.innerGradientDerivation
            let alpha = variant == .mono ? d.monoAlpha : d.alpha
            return blobFloats(
                spec.palettes.border[variant.rawValue]!.border,
                sizeScale: d.sizeScale,
                alphaOverride: alpha
            )
        }
    }

    // ── Conic stop arrays ([pos 0…1, alpha] pairs, flattened) ──

    private func flattenStops(_ stops: [[Double]]) -> [Float] {
        stops.flatMap { [Float($0[0] / 100), Float($0[1])] }
    }

    var whiteGradientStops: [Float] { flattenStops(spec.rotate.whiteGradientStops[theme]!) }
    var bloomGradientStops: [Float] { flattenStops(spec.rotate.bloomGradientStops[theme]!) }
    var beamMaskStops: [Float] { flattenStops(spec.rotate.beamMaskStops) }
    var smallMaskStops: [Float] { flattenStops(spec.rotate.smallMaskStops) }

    var innerShadowColor: BeamRGBA { BeamRGBA(css: themeConfig.innerShadow) ?? .clear }
    var innerShadowBlur: Double { size == .sm ? spec.rotate.innerShadowBlur.sm : spec.rotate.innerShadowBlur.md }

    // ── Per-frame values ──

    func beamAngle(at t: Double) -> Double {
        (t / duration).truncatingRemainder(dividingBy: 1)
    }

    /// Rotate-family hue shift: ±hueRange ping-pong over 12 s (web keyframes).
    func hueShiftDegrees(at t: Double) -> Double {
        guard !staticColors else { return 0 }
        let phase = t / spec.defaults.rotateHueShiftPeriod
        return -hueRange + 2 * hueRange * PulseDriver.pingPong(phase)
    }
}

/// The three composited layers of the rotate-family beam, driven per-frame by
/// `TimelineView`. Layer order matches the web z-indices: inner (1), stroke
/// (2), bloom (3, blurred).
struct RotateBeamLayers: View {
    let config: RotateBeamConfig
    let fade: BeamFade

    @Environment(\.beamFrozenTime) private var frozenTime

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = frozenTime ?? timeline.date.timeIntervalSinceReferenceDate
            layers(at: t, fade: frozenTime != nil ? 1 : fade.value(at: timeline.date))
        }
    }

    @ViewBuilder
    private func layers(at t: Double, fade: Double) -> some View {
        let angle = config.beamAngle(at: t)
        let hue = config.hueShiftDegrees(at: t)
        // Web parity: with staticColors the CSS stroke/inner layers have NO
        // filter at all — brightness/saturate exist only inside the hue-shift
        // keyframes. Only the bloom keeps its (static) filter.
        let filterMatrix: [Float] = config.staticColors
            ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
            : BeamColorMatrix.composed(
                hueDegrees: hue,
                brightness: config.finalBrightness,
                saturation: config.finalSaturation
            )
        // Bloom filter has no hue-rotate on the web (static brightness/saturate).
        let bloomMatrix = BeamColorMatrix.composed(
            hueDegrees: 0,
            brightness: config.finalBrightness,
            saturation: config.finalSaturation
        )
        let baseOpacity = fade * config.strength * config.monoMul

        GeometryReader { geo in
            let size = geo.size
            ZStack {
                // Inner glow (::before) — full rounded rect, conic window +
                // edge fade mask, inset shadow.
                shaderLayer(
                    size: size,
                    angle: angle,
                    kind: 1,
                    edgeMaskPx: config.size == .md ? config.spec.rotate.innerEdgeMaskPx : 0,
                    blobs: config.innerBlobs,
                    bg: [],
                    bgIsBlack: false,
                    maskStops: config.size == .sm ? config.smallMaskStops : config.beamMaskStops,
                    matrix: filterMatrix,
                    opacity: baseOpacity * config.themeConfig.innerOpacity,
                    shadow: config.innerShadowColor,
                    shadowBlur: config.innerShadowBlur
                )

                // Stroke ring (::after) — border band, color blobs under the
                // white conic highlight, conic beam-window mask.
                shaderLayer(
                    size: size,
                    angle: angle,
                    kind: 0,
                    edgeMaskPx: 0,
                    blobs: config.strokeBlobs,
                    bg: config.whiteGradientStops,
                    bgIsBlack: !config.isDark,
                    maskStops: config.beamMaskStops,
                    matrix: filterMatrix,
                    opacity: baseOpacity * config.themeConfig.strokeOpacity,
                    shadow: .clear,
                    shadowBlur: 0
                )

                // Bloom — border band with the bright conic ring pattern,
                // blurred (web: blur(8px) before brightness/saturate).
                shaderLayer(
                    size: size,
                    angle: angle,
                    kind: 2,
                    edgeMaskPx: 0,
                    blobs: [],
                    bg: config.bloomGradientStops,
                    bgIsBlack: !config.isDark,
                    maskStops: [],
                    matrix: bloomMatrix,
                    opacity: baseOpacity * config.themeConfig.bloomOpacity,
                    shadow: .clear,
                    shadowBlur: 0
                )
                .blur(radius: config.spec.rotate.bloomBlurPx)
            }
        }
    }

    private func shaderLayer(
        size: CGSize,
        angle: Double,
        kind: Double,
        edgeMaskPx: Double,
        blobs: [Float],
        bg: [Float],
        bgIsBlack: Bool,
        maskStops: [Float],
        matrix: [Float],
        opacity: Double,
        shadow: BeamRGBA,
        shadowBlur: Double
    ) -> some View {
        let shader = ShaderLibrary.bundle(.module).beamRotateLayer(
            .float2(size),
            .float(angle),
            .float(config.radius),
            .float(config.borderWidth),
            .float(kind),
            .float(edgeMaskPx),
            .floatArray(blobs),
            .floatArray(bg),
            .float(bgIsBlack ? 1 : 0),
            .floatArray(maskStops),
            .floatArray(matrix),
            .float(opacity),
            .color(Color(
                red: shadow.r,
                green: shadow.g,
                blue: shadow.b,
                opacity: shadow.a
            )),
            .float(shadowBlur)
        )
        return Rectangle()
            .fill(Color.white)
            .colorEffect(shader)
    }
}
