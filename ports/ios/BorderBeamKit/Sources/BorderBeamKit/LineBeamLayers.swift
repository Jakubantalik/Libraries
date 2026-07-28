import SwiftUI

/// Resolved configuration for the `line` family.
struct LineBeamConfig {
    let variant: BeamColorVariant
    let theme: String
    let staticColors: Bool
    let duration: Double
    let borderRadius: Double?
    let brightness: Double?
    let saturation: Double?
    let hueRange: Double // already capped at 13 by BorderBeam
    let strength: Double

    let spec = BeamSpec.shared

    var isDark: Bool { theme == "dark" }
    var themeConfig: BeamSpec.ThemeColors { spec.sizeThemePresets["line"]![theme]! }
    var sizeConfig: BeamSpec.SizeConfig { spec.sizePresets["line"]! }
    var radius: Double { borderRadius ?? sizeConfig.borderRadius }
    var finalBrightness: Double { brightness ?? themeConfig.brightness ?? spec.defaults.brightnessFallback }
    var finalSaturation: Double { saturation ?? themeConfig.saturation }
}

/// The three `line` layers: inner glow (z1), stroke band (z2), bloom (z3).
struct LineBeamLayers: View {
    let config: LineBeamConfig
    let fade: BeamFade

    @Environment(\.beamFrozenTime) private var frozenTime

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = frozenTime ?? timeline.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                layers(
                    at: t, size: geo.size,
                    fade: frozenTime != nil ? 1 : fade.value(at: timeline.date)
                )
            }
        }
    }

    @ViewBuilder
    private func layers(at t: Double, size: CGSize, fade: Double) -> some View {
        let spec = config.spec
        let v = BeamAnimation.lineFrameValues(spec.line.keyframes, at: t, duration: config.duration)
        let hue = config.staticColors
            ? 0
            : -config.hueRange + 2 * config.hueRange * PulseDriver.pingPong(t / spec.defaults.rotateHueShiftPeriod)
        let bloomRange = config.hueRange + spec.defaults.lineBloomHueRangeBonus
        let bloomHue = config.staticColors
            ? 0
            : -bloomRange + 2 * bloomRange * PulseDriver.pingPong(t / spec.defaults.lineBloomHueShiftPeriod)
        // Web parity: with staticColors the line layers carry no filter (the
        // brightness/saturate live only in the hue-shift keyframes); mono's
        // bloom keeps just its 6px blur, applied below.
        let identity: [Float] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
        let cm = config.staticColors ? identity : BeamColorMatrix.composed(
            hueDegrees: hue, brightness: config.finalBrightness, saturation: config.finalSaturation
        )
        let bloomCM = config.staticColors ? identity : BeamColorMatrix.composed(
            hueDegrees: bloomHue, brightness: config.finalBrightness, saturation: config.finalSaturation
        )

        let W = size.width
        let H = size.height
        let bx = v.x * W
        let base = fade * v.edge * config.strength

        let mask = spec.line.beamMaskEllipse
        let bloomMask = spec.line.bloomMaskEllipse
        let radial: [Float] = [
            Float(bx), Float(H),
            Float(mask.w * v.w), Float(mask.h * v.h),
            Float(mask.softStop[0] / 100), Float(mask.softStop[1]), 1,
        ]
        let bloomRadial: [Float] = [
            Float(bx), Float(H),
            Float(bloomMask.w * v.w), Float(bloomMask.h * v.h),
            Float(bloomMask.softStop[0] / 100), Float(bloomMask.softStop[1]), 1,
        ]

        // Web parity: the animated bloom filter includes blur(8px); mono with
        // static colors gets base blur(6px); other static variants none.
        let bloomBlur: Double = config.staticColors
            ? (config.variant == .mono ? spec.line.monoBloomExtraBlurPx : 0)
            : spec.line.bloomBlurPx

        ZStack {
            shaderLayer(
                size: size, geomKind: 1, edgeMaskPx: spec.rotate.innerEdgeMaskPx,
                radial: radial, blobs: innerBlobs(v: v, bx: bx, height: H),
                matrix: cm, opacity: base * config.themeConfig.innerOpacity
            )
            shaderLayer(
                size: size, geomKind: 0, edgeMaskPx: 0,
                radial: radial, blobs: strokeBlobs(v: v, bx: bx, height: H),
                matrix: cm, opacity: base * config.themeConfig.strokeOpacity
            )
            let bloom = shaderLayer(
                size: size, geomKind: 1, edgeMaskPx: 0,
                radial: bloomRadial, blobs: bloomBlobs(v: v, bx: bx, width: W, height: H),
                matrix: bloomCM, opacity: base * config.themeConfig.bloomOpacity
            )
            if bloomBlur > 0 {
                bloom.blur(radius: bloomBlur)
            } else {
                bloom
            }
        }
    }

    // ── Blob construction (mirrors border-beam-native LineBeam.tsx) ──

    private func strokeBlobs(v: BeamAnimation.LineFrameValues, bx: Double, height: Double) -> [Float] {
        let spec = config.spec
        var blobs: [Float] = []
        // White traveling highlight first (on top).
        if let wh = spec.line.whiteHighlight[config.theme] {
            let c = (wh.onBlack ?? false) ? 0.0 : 1.0
            let stops = wh.stops.map {
                BeamSpec.BloomStop(r: c * 255, g: c * 255, b: c * 255, a: $0[1], pos: $0[0] / 100)
            }
            blobs += BlobEncoder.stops(
                rx: wh.w * v.w, ry: wh.h * v.h, cx: bx, cy: height + wh.yOffset, stops: stops
            )
        }
        for e in spec.palettes.line[config.variant.rawValue]![config.theme]! {
            guard let c = BeamRGBA(css: e.color) else { continue }
            blobs += BlobEncoder.simple(
                rx: e.sizeW * v.w, ry: e.sizeH * v.h,
                cx: bx + e.offsetX, cy: height + e.offsetY, color: c
            )
        }
        return blobs
    }

    private func innerBlobs(v: BeamAnimation.LineFrameValues, bx: Double, height: Double) -> [Float] {
        var blobs: [Float] = []
        for e in config.spec.palettes.lineInner[config.variant.rawValue]! {
            guard let c = BeamRGBA(css: e.color) else { continue }
            blobs += BlobEncoder.simple(
                rx: e.sizeW * v.w, ry: e.sizeH * v.h,
                cx: bx + e.offsetX, cy: height - abs(e.offsetY), color: c
            )
        }
        return blobs
    }

    private func bloomBlobs(v: BeamAnimation.LineFrameValues, bx: Double, width: Double, height: Double) -> [Float] {
        var blobs: [Float] = []
        let grads = config.spec.line.bloomGradients[config.variant.rawValue]![config.theme]!
        for g in grads {
            let cx = g.xPct.map { $0 / 100 * width } ?? bx
            blobs += BlobEncoder.stops(
                rx: g.w.base * BeamAnimation.multValue(g.w.mult, v),
                ry: g.h.base * BeamAnimation.multValue(g.h.mult, v),
                cx: cx, cy: height + g.yOffPx, stops: g.stops
            )
        }
        return blobs
    }

    private func shaderLayer(
        size: CGSize,
        geomKind: Double,
        edgeMaskPx: Double,
        radial: [Float],
        blobs: [Float],
        matrix: [Float],
        opacity: Double
    ) -> some View {
        let shader = ShaderLibrary.bundle(.module).beamBlobLayer(
            .float2(0, 0),
            .float2(size),
            .float(config.radius),
            .float(config.sizeConfig.borderWidth),
            .float(geomKind),
            .float(edgeMaskPx),
            // Corner-wrap: the line family's blobs all anchor to the bottom
            // border, so evaluating them in border-path space bends the
            // traveling streak around the corner radius as it reaches the
            // ends. Identical along the straight bottom edge; iOS deviation
            // from the web renderer (see the pulse-inner layer note).
            .float(1),
            .floatArray(radial),
            .floatArray(blobs),
            .floatArray(matrix),
            .float(opacity)
        )
        return Rectangle().fill(Color.white).colorEffect(shader)
    }
}
