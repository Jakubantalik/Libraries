import Foundation

/// Direct port of the web library's `pulseDriver.ts` oscillator math.
///
/// Each oscillator ping-pongs a value between `a` and `b` with a cosine
/// ease-in-out over `period` seconds, offset by `delay` seconds. The web
/// version writes CSS custom properties from a shared 30 fps rAF loop; here the
/// values are sampled per-frame (via `TimelineView`) and fed to the pulse
/// shaders as uniforms.
enum PulseDriver {
    /// Cosine ease-in-out factor in [0, 1]: 0 at phase 0/1, 1 at phase 0.5.
    static func pingPong(_ phase: Double) -> Double {
        (1 - cos(2 * .pi * phase)) / 2
    }

    /// Samples one oscillator at absolute time `t` (seconds).
    static func value(of osc: BeamSpec.Oscillator, at t: Double, durationScale: Double = 1) -> Double {
        let period = osc.period * durationScale
        let delay = osc.delay * durationScale
        let phase = (t - delay) / period
        return osc.a + (osc.b - osc.a) * pingPong(phase)
    }

    /// Samples every oscillator of a pulse section into a `prop → value` table.
    /// `durationScale` is `duration / 2.3` (spec oscillators are emitted at the
    /// default 2.3 s pulse duration; periods scale linearly).
    static func sample(
        _ section: BeamSpec.PulseThemeSection,
        at t: Double,
        durationScale: Double
    ) -> [String: Double] {
        var out: [String: Double] = [:]
        out.reserveCapacity(section.oscillators.count)
        for osc in section.oscillators {
            out[osc.prop] = value(of: osc, at: t, durationScale: durationScale)
        }
        return out
    }

    /// Continuous full-circle hue rotation in degrees (pulse family).
    static func hueDegrees(at t: Double, period: Double) -> Double {
        (t / period).truncatingRemainder(dividingBy: 1) * 360
    }
}
