import Foundation
import Testing
@testable import BorderBeamKit

@Suite struct BeamSpecTests {
    @Test func specDecodes() {
        let spec = BeamSpec.shared
        #expect(spec.specVersion == "1.0.0")
        #expect(spec.palettes.border.count == 4)
        #expect(spec.palettes.border["colorful"]?.border.count == 9)
        #expect(spec.pulse.ringMap.count == 9)
        #expect(spec.pulse.inner["dark"]?.oscillators.count == 17)
        #expect(spec.sizeThemePresets["md"]?["dark"] != nil)
        #expect(spec.sizeThemePresets["pulse-outside"]?["light"] != nil)
    }

    @Test func colorParsing() throws {
        let rgb = try #require(BeamRGBA(css: "rgb(255, 50, 100)"))
        #expect(rgb.r == 1)
        #expect(abs(rgb.g - 50.0 / 255.0) < 1e-9)
        #expect(rgb.a == 1)

        let rgba = try #require(BeamRGBA(css: "rgba(40, 140, 255, 0.5)"))
        #expect(rgba.a == 0.5)

        #expect(BeamRGBA(css: "transparent") == .clear)
    }

    @Test func percentAndPixelParsing() {
        let p = parsePercentPair("33% -7.4%")
        #expect(abs(p.x - 0.33) < 1e-9)
        #expect(abs(p.y - -0.074) < 1e-9)

        let s = parsePixelPair("70px 40px")
        #expect(s.width == 70)
        #expect(s.height == 40)
    }

    @Test func oscillatorMathMatchesWebDriver() {
        // pingPong(0) = 0, pingPong(0.5) = 1 (cosine ease-in-out ping-pong).
        #expect(abs(PulseDriver.pingPong(0)) < 1e-12)
        #expect(abs(PulseDriver.pingPong(0.5) - 1) < 1e-12)
        #expect(abs(PulseDriver.pingPong(0.25) - 0.5) < 1e-12)

        // Value at t = delay must equal `a` (web animation-delay semantics).
        let osc = BeamSpec.Oscillator(prop: "bw1", a: 0.72, b: 1.308, period: 2.34, delay: 0.5, unit: "")
        #expect(abs(PulseDriver.value(of: osc, at: 0.5) - 0.72) < 1e-9)
        #expect(abs(PulseDriver.value(of: osc, at: 0.5 + 2.34 / 2) - 1.308) < 1e-9)
    }

    @Test func lineSpecDecodes() {
        let spec = BeamSpec.shared
        #expect(spec.line.keyframes.travel.x.count == 11)
        #expect(spec.line.bloomGradients["colorful"]?["dark"]?.count == 9)
        #expect(spec.line.bloomGradients["colorful"]?["light"]?.count == 8)
        // Mono attenuation baked into the spec (0.14 on the first spike).
        let monoSpike = spec.line.bloomGradients["mono"]?["dark"]?.first
        #expect(monoSpike?.stops.first?.a == 0.14)
        #expect(spec.pulse.outsideConstants.bloomInsetPx == 30)
        #expect(spec.pulse.innerCornerAccent.sizePx == 60)
    }

    @Test func lineKeyframeSampling() {
        let spec = BeamSpec.shared
        let tables = spec.line.keyframes
        // Mid-cycle: x = 0.5, w = 1.5, edge = 1 (from the web keyframe tables).
        let v = BeamAnimation.lineFrameValues(tables, at: 3.1 * 0.5, duration: 3.1)
        #expect(abs(v.x - 0.5) < 1e-9)
        #expect(abs(v.w - 1.5) < 1e-9)
        #expect(abs(v.edge - 1.0) < 1e-9)
        // Cycle start: x = 0.06, w = 0.5, edge = 0.
        let v0 = BeamAnimation.lineFrameValues(tables, at: 0, duration: 3.1)
        #expect(abs(v0.x - 0.06) < 1e-9)
        #expect(abs(v0.edge) < 1e-9)
    }

    @Test func cssTimingCurves() {
        // ease-in-out is symmetric: f(0.5) = 0.5.
        #expect(abs(BeamAnimation.cssEaseInOut(0.5) - 0.5) < 1e-3)
        #expect(BeamAnimation.cssEaseInOut(0) == 0)
        #expect(BeamAnimation.cssEaseInOut(1) == 1)
        // CSS `ease` is front-loaded: f(0.5) ≈ 0.8.
        let mid = BeamAnimation.cssEase(0.5)
        #expect(mid > 0.7 && mid < 0.9)
    }

    @Test func fadeEvaluatesOverTime() {
        let start = Date()
        let fade = BeamFade(from: 0, target: 1, start: start, duration: 0.6)
        #expect(fade.value(at: start) == 0)
        #expect(fade.value(at: start.addingTimeInterval(0.6)) == 1)
        let mid = fade.value(at: start.addingTimeInterval(0.3))
        #expect(mid > 0.5 && mid < 1)
    }

    @Test func hueRotateMatrixIdentityAtZero() {
        let m = BeamColorMatrix.composed(hueDegrees: 0, brightness: 1, saturation: 1)
        let identity: [Float] = [1, 0, 0, 0, 1, 0, 0, 0, 1]
        for (a, b) in zip(m, identity) {
            #expect(abs(a - b) < 1e-5)
        }
    }
}
