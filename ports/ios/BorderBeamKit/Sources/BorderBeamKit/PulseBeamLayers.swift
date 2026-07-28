import SwiftUI

/// Resolved configuration for the pulse family.
struct PulseBeamConfig {
    let size: BeamSize // .pulseInner or .pulseOutside
    let variant: BeamColorVariant
    let theme: String
    let staticColors: Bool
    let duration: Double
    let borderRadius: Double?
    let brightness: Double?
    let saturation: Double?
    let strength: Double
    let reduceMotion: Bool
    let tuning: BeamTuning

    let spec = BeamSpec.shared

    static let defaultPulseDuration = 2.3

    var isDark: Bool { theme == "dark" }
    var isOutside: Bool { size == .pulseOutside }
    var themeConfig: BeamSpec.ThemeColors { spec.sizeThemePresets[size.rawValue]![theme]! }
    var sizeConfig: BeamSpec.SizeConfig { spec.sizePresets[size.rawValue]! }
    var radius: Double { borderRadius ?? sizeConfig.borderRadius }
    var monoMul: Double { variant == .mono ? spec.defaults.monoOpacityMultiplier : 1 }
    var finalBrightness: Double { brightness ?? themeConfig.brightness ?? spec.defaults.brightnessFallback }
    var finalSaturation: Double { saturation ?? themeConfig.saturation }
    var themeSection: BeamSpec.PulseThemeSection {
        (isOutside ? spec.pulse.outside : spec.pulse.inner)[theme]!
    }
    var durationScale: Double { duration / Self.defaultPulseDuration }
    var huePeriod: Double { spec.pulse.huePeriod[size.rawValue] ?? 16 }
    var oc: BeamSpec.OutsideConstants { spec.pulse.outsideConstants }

    /// Measured per-element glow scale. The web clamps the *measured* ratio and
    /// then applies `--pulse-glow-boost` on top, so the boost is deliberately
    /// outside the clamp.
    func glowScale(for elementSize: CGSize) -> (x: Double, y: Double) {
        guard isOutside else { return (1, 1) }
        let clamp = { (v: Double) in
            min(oc.scaleClamp.max, max(oc.scaleClamp.min, v))
        }
        return (
            clamp(elementSize.width / oc.referenceSize.w) * tuning.glowBoost,
            clamp(elementSize.height / oc.referenceSize.h) * tuning.glowBoost
        )
    }
}

/// Static description of one pulse blob, resolved per-frame with oscillators.
private struct PulseBlobDef {
    let region: Int  // 1-3 size/drift region; 0 = static (corner accents)
    let quad: String
    let w: Double
    let h: Double
    let xFrac: Double
    let yFrac: Double
    let color: BeamRGBA
    let fadeEnd: Double
}

/// Which part of the pulse effect to render — `pulse-outside` splits into a
/// behind-the-content glow (web z-index -1) and an above-content stroke ring.
enum PulseBeamPart {
    case all      // pulse-inner single overlay
    case glow     // pulse-outside: core + bloom, in .background
    case stroke   // pulse-outside: 1px ring, in .overlay
}

struct PulseBeamLayers: View {
    let config: PulseBeamConfig
    let fade: BeamFade
    let part: PulseBeamPart

    @Environment(\.beamFrozenTime) private var frozenTime

    var body: some View {
        // Not paused under reduced motion: the fade still needs frames — the
        // breathing itself is frozen by pinning t to 0 below.
        TimelineView(.animation) { timeline in
            let t = frozenTime ?? (config.reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate)
            GeometryReader { geo in
                layers(
                    at: t, elementSize: geo.size,
                    fade: frozenTime != nil ? 1 : fade.value(at: timeline.date)
                )
            }
        }
    }

    // MARK: - Blob defs (mirrors border-beam-native PulseBeam.tsx)

    private func ringDefs() -> [PulseBlobDef] {
        let spec = config.spec
        let palette = spec.palettes.border[config.variant.rawValue]!.border
        return palette.enumerated().map { i, blob in
            let c = BeamRGBA(css: blob.color) ?? .clear
            let pos = parsePercentPair(blob.pos)
            let size = parsePixelPair(blob.size)
            let entry = spec.pulse.ringMap[i]
            return PulseBlobDef(
                region: entry.region, quad: entry.quad,
                w: size.width, h: size.height,
                xFrac: pos.x, yFrac: pos.y, color: c, fadeEnd: 1
            )
        }
    }

    private func tableDefs(_ table: [BeamSpec.PulseGradientEntry]) -> [PulseBlobDef] {
        let palette = config.spec.palettes.border[config.variant.rawValue]!.border
        return table.map { e in
            let src = palette[e.ci]
            let c = BeamRGBA(css: src.color) ?? .clear
            let srcPos = parsePercentPair(src.pos)
            let x = e.x.flatMap { Double($0.replacingOccurrences(of: "%", with: "")) }.map { $0 / 100 } ?? srcPos.x
            let y = e.y.flatMap { Double($0.replacingOccurrences(of: "%", with: "")) }.map { $0 / 100 } ?? srcPos.y
            return PulseBlobDef(
                region: e.region, quad: e.quad, w: e.w, h: e.h,
                xFrac: x, yFrac: y, color: c, fadeEnd: 1
            )
        }
    }

    private func innerDefs() -> [PulseBlobDef] {
        let spec = config.spec
        var defs = ringDefs().enumerated().map { i, d in
            PulseBlobDef(
                region: d.region, quad: d.quad,
                w: spec.pulse.innerSizes[i][0], h: spec.pulse.innerSizes[i][1],
                xFrac: d.xFrac, yFrac: d.yFrac, color: d.color, fadeEnd: d.fadeEnd
            )
        }
        let accent = spec.pulse.innerCornerAccent
        let alpha = config.isDark ? accent.alpha.dark : accent.alpha.light
        let channel = config.isDark ? 1.0 : 0.0
        let corner = BeamRGBA(r: channel, g: channel, b: channel, a: alpha)
        for (x, y, quad) in [(0.0, 0.0, "tl"), (1.0, 0.0, "tr"), (0.0, 1.0, "bl"), (1.0, 1.0, "br")] {
            defs.append(PulseBlobDef(
                region: 0, quad: quad,
                w: accent.sizePx, h: accent.sizePx,
                xFrac: x, yFrac: y, color: corner, fadeEnd: accent.fadeStop / 100
            ))
        }
        return defs
    }

    // MARK: - Per-frame blob building

    private func liveBlobs(
        _ defs: [PulseBlobDef],
        osc: [String: Double],
        boxOrigin: CGPoint,
        boxSize: CGSize,
        sx: Double,
        sy: Double
    ) -> [Float] {
        var out: [Float] = []
        out.reserveCapacity(defs.count * 14)
        for d in defs {
            let bw = d.region > 0 ? osc["bw\(d.region)"] ?? 1 : 1
            let bh = d.region > 0 ? (osc["bh\(d.region)"] ?? 1) * (osc["bgh"] ?? 1) : 1
            let dx = d.region > 0 ? osc["bx\(d.region)"] ?? 0 : 0
            let dy = d.region > 0 ? osc["by\(d.region)"] ?? 0 : 0
            let bop = osc["bop-\(d.quad)"] ?? 1
            // Ring/table blobs replace their alpha with the quadrant opacity
            // (web withAlphaVar); static corner accents multiply their base.
            let alpha = d.region == 0 ? d.color.a * bop : bop
            let end = d.fadeEnd
            // Which border edge the blob hugs, for the shader's corner-wrap
            // evaluation: 1 when it sits against a left/right edge (its height
            // runs along the border), 0 for top/bottom. Ignored outside wrap
            // mode (the reserved 14th float was always 0 before).
            let edgeDistX = max(min(d.xFrac, 1 - d.xFrac) * boxSize.width, 0)
            let edgeDistY = max(min(d.yFrac, 1 - d.yFrac) * boxSize.height, 0)
            let vertical: Float = edgeDistX < edgeDistY ? 1 : 0
            out += [
                Float(d.w * bw * sx), Float(d.h * bh * sy),
                Float(boxOrigin.x + d.xFrac * boxSize.width + dx),
                Float(boxOrigin.y + d.yFrac * boxSize.height + dy),
                Float(d.color.r), Float(d.color.g), Float(d.color.b), Float(alpha),
                Float(end / 3), Float(alpha * 2 / 3), Float(2 * end / 3), Float(alpha / 3), Float(end),
                vertical,
            ]
        }
        return out
    }

    private func frozenBloomBlobs(
        boxSize: CGSize, boxOrigin: CGPoint, sx: Double, sy: Double
    ) -> [Float] {
        let table = config.isOutside ? config.spec.pulse.outerBloom : config.spec.pulse.innerBloom
        let frozen = config.themeSection.frozenBloomAlpha
        var out: [Float] = []
        for d in tableDefs(table) {
            let stops = [
                BeamSpec.BloomStop(r: d.color.r * 255, g: d.color.g * 255, b: d.color.b * 255, a: frozen, pos: 0),
                BeamSpec.BloomStop(r: d.color.r * 255, g: d.color.g * 255, b: d.color.b * 255, a: 0, pos: 1),
            ]
            out += BlobEncoder.stops(
                rx: d.w * sx, ry: d.h * sy,
                cx: boxOrigin.x + d.xFrac * boxSize.width,
                cy: boxOrigin.y + d.yFrac * boxSize.height,
                stops: stops
            )
        }
        return out
    }

    // MARK: - Layer assembly

    @ViewBuilder
    private func layers(at t: Double, elementSize: CGSize, fade: Double) -> some View {
        let spec = config.spec
        let osc = PulseDriver.sample(config.themeSection, at: t, durationScale: config.durationScale)
        let hue = (config.staticColors || config.reduceMotion)
            ? 0
            : PulseDriver.hueDegrees(at: t, period: config.huePeriod)
        let tuning = config.tuning
        let cm = BeamColorMatrix.composed(
            hueDegrees: hue, brightness: config.finalBrightness, saturation: config.finalSaturation
        )
        // The outward glow layers take their own brightness/saturate overrides
        // but keep the shared hue rotation, so halo and ring stay color-synced.
        let glowCM = BeamColorMatrix.composed(
            hueDegrees: hue,
            brightness: tuning.glowBrightness ?? config.finalBrightness,
            saturation: tuning.glowSaturate ?? config.finalSaturation
        )
        let base = fade * config.strength * config.monoMul
        let oc = config.oc
        let scale = config.glowScale(for: elementSize)
        let bloomBlur = tuning.bloomBlur ?? (config.isOutside
            ? (config.isDark ? oc.bloomBlurPx.dark : oc.bloomBlurPx.light)
            : spec.pulse.innerBloomBlurPx)

        if config.isOutside {
            switch part {
            case .stroke, .all:
                shaderLayer(
                    boxPad: 0, elementSize: elementSize,
                    radius: config.radius, borderWidth: 1, geomKind: 0, edgeMaskPx: 0,
                    blobs: liveBlobs(
                        tableDefs(spec.pulse.outerCore), osc: osc,
                        boxOrigin: .zero, boxSize: elementSize, sx: scale.x, sy: scale.y
                    ),
                    matrix: cm,
                    opacity: base * config.themeConfig.strokeOpacity * tuning.strokeOpacity
                )
            case .glow:
                let corePad = oc.coreInsetPx
                let coreSize = CGSize(
                    width: elementSize.width + corePad * 2,
                    height: elementSize.height + corePad * 2
                )
                let bloomPad = oc.bloomInsetPx
                let bloomSize = CGSize(
                    width: elementSize.width + bloomPad * 2,
                    height: elementSize.height + bloomPad * 2
                )
                ZStack {
                    shaderLayer(
                        boxPad: bloomPad, elementSize: elementSize,
                        radius: config.radius + bloomPad, borderWidth: 1, geomKind: 1, edgeMaskPx: 0,
                        blobs: frozenBloomBlobs(boxSize: bloomSize, boxOrigin: .zero, sx: scale.x, sy: scale.y),
                        matrix: glowCM,
                        opacity: base * config.themeConfig.bloomOpacity * tuning.bloomOpacity
                    )
                    .blur(radius: bloomBlur)
                    shaderLayer(
                        boxPad: corePad, elementSize: elementSize,
                        radius: config.radius + corePad, borderWidth: 1, geomKind: 1, edgeMaskPx: 0,
                        blobs: liveBlobs(
                            tableDefs(spec.pulse.outerCore), osc: osc,
                            boxOrigin: .zero, boxSize: coreSize, sx: scale.x, sy: scale.y
                        ),
                        matrix: glowCM,
                        opacity: base * config.themeConfig.innerOpacity * tuning.innerOpacity
                    )
                    .blur(radius: tuning.coreBlur ?? (config.isDark ? oc.glowBlurPx.dark : oc.glowBlurPx.light))
                }
                // Web parity: core + bloom carry `transform: scale(0.95, 0.9)`.
                .scaleEffect(x: oc.glowScale.x, y: oc.glowScale.y)
            }
        } else {
            // pulse-inner: single overlay with inner (z1) + ring (z2) + bloom (z3).
            ZStack {
                shaderLayer(
                    boxPad: 0, elementSize: elementSize,
                    radius: config.radius, borderWidth: config.sizeConfig.borderWidth,
                    geomKind: 1, edgeMaskPx: spec.rotate.innerEdgeMaskPx,
                    // Corner-wrap: evaluate the glow in border-path space so it
                    // bends with the corner radius instead of straight-edged
                    // ellipses clashing where two edges meet. iOS-only
                    // deviation from the web renderer (which shows the same
                    // artifact); keep the SkSL twin in sync when porting.
                    wrapCorners: 1,
                    blobs: liveBlobs(
                        innerDefs(), osc: osc, boxOrigin: .zero, boxSize: elementSize,
                        sx: tuning.innerSizeScale, sy: tuning.innerSizeScale
                    ),
                    matrix: cm,
                    opacity: base * config.themeConfig.innerOpacity * tuning.innerOpacity
                )
                shaderLayer(
                    boxPad: 0, elementSize: elementSize,
                    radius: config.radius, borderWidth: config.sizeConfig.borderWidth,
                    geomKind: 0, edgeMaskPx: 0,
                    blobs: liveBlobs(ringDefs(), osc: osc, boxOrigin: .zero, boxSize: elementSize, sx: 1, sy: 1),
                    matrix: cm,
                    opacity: base * config.themeConfig.strokeOpacity * tuning.strokeOpacity
                )
                shaderLayer(
                    boxPad: 0, elementSize: elementSize,
                    radius: config.radius, borderWidth: config.sizeConfig.borderWidth,
                    geomKind: 0, edgeMaskPx: 0,
                    blobs: frozenBloomBlobs(boxSize: elementSize, boxOrigin: .zero, sx: 1, sy: 1),
                    matrix: cm,
                    opacity: base * config.themeConfig.bloomOpacity * tuning.bloomOpacity
                )
                .blur(radius: bloomBlur)
            }
        }
    }

    /// Renders one shader layer. All shader inputs are in the LAYER BOX's own
    /// coordinate space (origin at the box top-left); `boxPad` is how far the
    /// box extends beyond the element on each side — the view is centered on
    /// the element so a padded box hangs over evenly (SwiftUI doesn't clip).
    private func shaderLayer(
        boxPad: Double,
        elementSize: CGSize,
        radius: Double,
        borderWidth: Double,
        geomKind: Double,
        edgeMaskPx: Double,
        wrapCorners: Double = 0,
        blobs: [Float],
        matrix: [Float],
        opacity: Double
    ) -> some View {
        let boxSize = CGSize(
            width: elementSize.width + boxPad * 2,
            height: elementSize.height + boxPad * 2
        )
        let shader = ShaderLibrary.bundle(.module).beamBlobLayer(
            .float2(0, 0),
            .float2(boxSize),
            .float(radius),
            .float(borderWidth),
            .float(geomKind),
            .float(edgeMaskPx),
            .float(wrapCorners),
            .floatArray(BlobEncoder.noRadial),
            .floatArray(blobs),
            .floatArray(matrix),
            .float(opacity)
        )
        return Rectangle()
            .fill(Color.white)
            .colorEffect(shader)
            .frame(width: boxSize.width, height: boxSize.height)
            .position(x: elementSize.width / 2, y: elementSize.height / 2)
    }
}
