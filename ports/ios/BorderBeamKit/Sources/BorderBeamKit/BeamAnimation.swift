import Foundation

/// Line-family animation math — CSS keyframe tables sampled with the same
/// per-segment timing functions the web uses. Mirrors border-beam-native's
/// lineDriver.ts (keep in sync).
enum BeamAnimation {
    /// y for progress x on a CSS cubic-bezier timing curve.
    static func cubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ x: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        var lo = 0.0
        var hi = 1.0
        var t = x
        for _ in 0..<12 {
            let mt = 1 - t
            let bx = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t
            if bx < x { lo = t } else { hi = t }
            t = (lo + hi) / 2
        }
        let mt = 1 - t
        return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t
    }

    /// CSS ease-in-out = cubic-bezier(0.42, 0, 0.58, 1).
    static func cssEaseInOut(_ x: Double) -> Double {
        cubicBezier(0.42, 0, 0.58, 1, x)
    }

    /// CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1) — the fade timing curve.
    static func cssEase(_ x: Double) -> Double {
        cubicBezier(0.25, 0.1, 0.25, 1, x)
    }

    /// Samples a [[percent, value]] keyframe table at cycle progress p (0…1).
    static func sampleKeyframes(_ table: [[Double]], at p: Double, easeInOut: Bool) -> Double {
        let pct = p * 100
        guard let first = table.first, let last = table.last else { return 0 }
        if pct <= first[0] { return first[1] }
        for i in 1..<table.count {
            let p0 = table[i - 1][0]
            let v0 = table[i - 1][1]
            let p1 = table[i][0]
            let v1 = table[i][1]
            if pct <= p1 {
                let f = p1 > p0 ? (pct - p0) / (p1 - p0) : 1
                let eased = easeInOut ? cssEaseInOut(f) : f
                return v0 + (v1 - v0) * eased
            }
        }
        return last[1]
    }

    struct LineFrameValues {
        let x: Double
        let w: Double
        let h: Double
        let spike: Double
        let spike2: Double
        let edge: Double
    }

    /// Samples every line animation at absolute time t (seconds).
    static func lineFrameValues(
        _ tables: BeamSpec.KeyframeTables,
        at t: Double,
        duration: Double
    ) -> LineFrameValues {
        func cyc(_ period: Double) -> Double {
            (t / period).truncatingRemainder(dividingBy: 1)
        }
        let ds = tables.durationScale
        return LineFrameValues(
            x: sampleKeyframes(tables.travel.x, at: cyc(duration * ds.travel), easeInOut: false),
            w: sampleKeyframes(tables.travel.w, at: cyc(duration * ds.travel), easeInOut: false),
            h: sampleKeyframes(tables.breathe, at: cyc(duration * ds.breathe), easeInOut: true),
            spike: sampleKeyframes(tables.spike, at: cyc(duration * ds.spike), easeInOut: true),
            spike2: sampleKeyframes(tables.spike2, at: cyc(duration * ds.spike2), easeInOut: true),
            edge: sampleKeyframes(tables.edgeFade, at: cyc(duration * ds.edgeFade), easeInOut: false)
        )
    }

    /// Resolves a bloom-gradient size multiplier variable.
    static func multValue(_ mult: String, _ v: LineFrameValues) -> Double {
        switch mult {
        case "spike": return v.spike
        case "spike2": return v.spike2
        case "inv-spike": return 2 - v.spike
        case "inv-spike2": return 2 - v.spike2
        case "h": return v.h
        case "w": return v.w
        default: return 1
        }
    }
}

/// Time-based fade state — shader uniforms can't be driven by `withAnimation`,
/// so the fade is evaluated per-frame inside each layer's `TimelineView`
/// (web parity: beam-fade-in 0.6 s / beam-fade-out 0.5 s, CSS `ease`).
struct BeamFade: Equatable {
    var from: Double
    var target: Double
    var start: Date
    var duration: Double

    static let hidden = BeamFade(from: 0, target: 0, start: .distantPast, duration: 0)

    func value(at date: Date) -> Double {
        guard duration > 0 else { return target }
        let p = min(1, max(0, date.timeIntervalSince(start) / duration))
        return from + (target - from) * BeamAnimation.cssEase(p)
    }
}

/// Blob record encoding for the `beamBlobLayer` shader — 14 floats per blob:
/// [rx, ry, cxPx, cyPx, r, g, b, a0, p1, a1, p2, a2, p3, reserved].
/// Mirrors border-beam-native's blobShader.ts encoders.
enum BlobEncoder {
    /// Plain 2-stop CSS `color → transparent` blob (linear alpha falloff).
    static func simple(
        rx: Double, ry: Double, cx: Double, cy: Double, color: BeamRGBA, alpha: Double? = nil
    ) -> [Float] {
        let a = alpha ?? color.a
        return [
            Float(rx), Float(ry), Float(cx), Float(cy),
            Float(color.r), Float(color.g), Float(color.b), Float(a),
            Float(1.0 / 3), Float(a * 2 / 3), Float(2.0 / 3), Float(a / 3), 1, 0,
        ]
    }

    /// Blob from spec bloom stops (2-4 stops; RGB from the first stop).
    static func stops(
        rx: Double, ry: Double, cx: Double, cy: Double, stops: [BeamSpec.BloomStop]
    ) -> [Float] {
        guard let first = stops.first else { return [] }
        let r = first.r / 255
        let g = first.g / 255
        let b = first.b / 255
        let a0 = first.a
        var p1 = 1.0 / 3, a1 = a0 * 2 / 3, p2 = 2.0 / 3, a2 = a0 / 3, p3 = 1.0
        if stops.count == 3 {
            p1 = stops[1].pos
            a1 = stops[1].a
            p3 = stops[2].pos
            p2 = (p1 + p3) / 2
            a2 = a1 / 2
        } else if stops.count >= 4 {
            p1 = stops[1].pos
            a1 = stops[1].a
            p2 = stops[2].pos
            a2 = stops[2].a
            p3 = stops[3].pos
        } else if stops.count == 2 {
            let end = stops[1].pos
            p1 = end / 3
            a1 = a0 * 2 / 3
            p2 = 2 * end / 3
            a2 = a0 / 3
            p3 = end
        }
        return [
            Float(rx), Float(ry), Float(cx), Float(cy),
            Float(r), Float(g), Float(b), Float(a0),
            Float(p1), Float(a1), Float(p2), Float(a2), Float(p3), 0,
        ]
    }

    /// Disabled radial-mask uniform.
    static let noRadial: [Float] = [0, 0, 1, 1, 0.5, 0.5, 0]
}
