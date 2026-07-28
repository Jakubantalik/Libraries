import Foundation
import SwiftUI
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
        #expect(spec.customColors.referenceVariant == "colorful")
        #expect(spec.customColors.lineBloomColorMap == [0, 1, 0, 1, 2, 3, 4])
    }

    /// Five distinct single-channel colors make every cycling index and every
    /// bloom-map entry byte-distinguishable — a swapped or collapsed mapping
    /// in ANY family fails these assertions.
    static let cycleColors: [(Double, Double, Double)] = [
        (10, 0, 0), (0, 20, 0), (0, 0, 30), (40, 40, 0), (0, 50, 50),
    ]

    static func makeCyclePalette() -> BeamCustomPalette? {
        BeamCustomPalette(
            colors: cycleColors.map { Color(red: $0.0 / 255, green: $0.1 / 255, blue: $0.2 / 255) },
            environment: EnvironmentValues()
        )
    }

    /// Expected solid color string for cycle index i.
    static func cycleCSS(_ i: Int) -> String {
        let c = cycleColors[i % cycleColors.count]
        return "rgb(\(Int(c.0)), \(Int(c.1)), \(Int(c.2)))"
    }

    @Test func customPaletteRecolorsReferenceGeometry() throws {
        let palette = try #require(Self.makeCyclePalette())
        let spec = BeamSpec.shared

        // Border: colors cycle in order, geometry verbatim from the reference.
        let ref = spec.palettes.border["colorful"]!.border
        #expect(palette.border.count == ref.count)
        for (i, blob) in palette.border.enumerated() {
            #expect(blob.color == Self.cycleCSS(i))
            #expect(blob.pos == ref[i].pos)
            #expect(blob.size == ref[i].size)
        }

        // Small border/inner: cycling + per-stop alpha retention (inner refs
        // are rgba; the custom color keeps the reference alpha exactly).
        let refSmall = spec.palettes.small["colorful"]!
        for (i, blob) in palette.smallBorder.enumerated() {
            #expect(BeamRGBA(css: blob.color) == BeamRGBA(css: Self.cycleCSS(i)))
        }
        for (i, blob) in palette.smallInner.enumerated() {
            let got = try #require(BeamRGBA(css: blob.color))
            let refAlpha = try #require(BeamRGBA(css: refSmall.inner[i].color)?.a)
            let want = try #require(BeamRGBA(css: Self.cycleCSS(i)))
            #expect(got.r == want.r && got.g == want.g && got.b == want.b)
            #expect(abs(got.a - refAlpha) < 1e-9)
        }

        // Line (both themes): cycling over each theme's own geometry.
        for theme in ["dark", "light"] {
            let refLine = spec.palettes.line["colorful"]![theme]!
            let gotLine = try #require(palette.line[theme])
            #expect(gotLine.count == refLine.count)
            for (i, blob) in gotLine.enumerated() {
                #expect(blob.color == Self.cycleCSS(i))
                #expect(blob.sizeW == refLine[i].sizeW && blob.offsetX == refLine[i].offsetX)
            }
        }

        // Line inner: cycling + alpha retention.
        let refLineInner = spec.palettes.lineInner["colorful"]!
        for (i, blob) in palette.lineInner.enumerated() {
            let got = try #require(BeamRGBA(css: blob.color))
            let want = try #require(BeamRGBA(css: Self.cycleCSS(i)))
            let refAlpha = try #require(BeamRGBA(css: refLineInner[i].color)?.a)
            #expect(got.r == want.r && got.g == want.g && got.b == want.b)
            #expect(abs(got.a - refAlpha) < 1e-9)
        }
    }

    /// The full lineBloomColorMap contract, both themes: every mapped
    /// gradient's stops carry the mapped cycle color with the reference
    /// alphas; every trailing gradient (glow dot, ambient, light shadow) is
    /// untouched. Would fail for a swapped, collapsed, or truncated map.
    @Test func customPaletteAppliesFullLineBloomMap() throws {
        let palette = try #require(Self.makeCyclePalette())
        let spec = BeamSpec.shared
        let map = spec.customColors.lineBloomColorMap

        for theme in ["dark", "light"] {
            let ref = spec.line.bloomGradients["colorful"]![theme]!
            let got = try #require(palette.lineBloom[theme])
            #expect(got.count == ref.count)
            for (i, gradient) in got.enumerated() {
                if i < map.count {
                    let want = try #require(BeamRGBA(css: Self.cycleCSS(map[i])))
                    for (s, stop) in gradient.stops.enumerated() {
                        #expect(stop.r == want.r * 255 && stop.g == want.g * 255 && stop.b == want.b * 255)
                        #expect(stop.a == ref[i].stops[s].a)
                        #expect(stop.pos == ref[i].stops[s].pos)
                    }
                } else {
                    for (s, stop) in gradient.stops.enumerated() {
                        let r = ref[i].stops[s]
                        #expect(stop.r == r.r && stop.g == r.g && stop.b == r.b && stop.a == r.a)
                    }
                }
            }
        }
    }

    @Test func customPaletteSingleColorAndEmptyList() {
        // A single color paints every stop (monochrome brand beam). The
        // mid-tone channel values also pin sRGB (gamma) resolution — a
        // linear-space mistake in cssString would shift 230 to ~201.
        let single = BeamCustomPalette(
            colors: [Color(red: 230 / 255, green: 57 / 255, blue: 70 / 255)],
            environment: EnvironmentValues()
        )
        #expect(single?.border.allSatisfy { $0.color == "rgb(230, 57, 70)" } == true)
        // An empty list fails so the preset variant applies.
        #expect(BeamCustomPalette(colors: [], environment: EnvironmentValues()) == nil)
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
