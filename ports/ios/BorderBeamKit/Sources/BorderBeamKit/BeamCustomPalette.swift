import SwiftUI

/// Palette set built from user-supplied custom colors (web `colors` prop
/// parity, see styles.ts `buildCustomPalettes`).
///
/// Every family keeps ALL of the hand-tuned geometry (positions, sizes,
/// per-stop alphas) of the spec's reference variant and only substitutes the
/// colors, cycling through the user's list in order (stop i gets
/// colors[i % n], so the first color is the most prominent). Alpha in the
/// inputs is ignored — every layer manages its own opacity. Custom palettes
/// always render with static colors so brand hues stay exact.
struct BeamCustomPalette {
    /// md ring + pulse family perimeter blobs (9).
    let border: [BeamSpec.GradientBlob]
    /// sm (button) variant stroke / inner blobs (8 each).
    let smallBorder: [BeamSpec.GradientBlob]
    let smallInner: [BeamSpec.GradientBlob]
    /// Traveling line blobs per theme (9 each).
    let line: [String: [BeamSpec.LineBlob]]
    let lineInner: [BeamSpec.LineBlob]
    /// Pre-baked line bloom gradients per theme, recolored via the spec's
    /// `customColors.lineBloomColorMap` (trailing glow dot / ambient / shadow
    /// gradients keep their built-in colors).
    let lineBloom: [String: [BeamSpec.BloomGradient]]

    /// Fails on an empty list, so the caller falls back to the preset
    /// `colorVariant` (web parity). Colors resolve against `environment` so
    /// dynamic/adaptive colors (`.primary`, asset-catalog colors) follow the
    /// view's actual appearance — rebuild the palette when it changes (the
    /// component does this by deriving it in `body`).
    init?(colors: [Color], environment: EnvironmentValues) {
        guard !colors.isEmpty else { return nil }
        let css = colors.map { Self.cssString(for: $0, in: environment) }

        let spec = BeamSpec.shared
        let refKey = spec.customColors.referenceVariant
        let at = { (i: Int) in css[i % css.count] }

        border = spec.palettes.border[refKey]!.border.enumerated().map { i, blob in
            BeamSpec.GradientBlob(color: at(i), pos: blob.pos, size: blob.size)
        }

        let small = spec.palettes.small[refKey]!
        smallBorder = small.border.enumerated().map { i, blob in
            BeamSpec.GradientBlob(color: Self.recolor(blob.color, with: at(i)), pos: blob.pos, size: blob.size)
        }
        smallInner = small.inner.enumerated().map { i, blob in
            BeamSpec.GradientBlob(color: Self.recolor(blob.color, with: at(i)), pos: blob.pos, size: blob.size)
        }

        line = spec.palettes.line[refKey]!.mapValues { blobs in
            blobs.enumerated().map { i, blob in
                BeamSpec.LineBlob(
                    color: at(i),
                    sizeW: blob.sizeW, sizeH: blob.sizeH,
                    offsetX: blob.offsetX, offsetY: blob.offsetY
                )
            }
        }

        lineInner = spec.palettes.lineInner[refKey]!.enumerated().map { i, blob in
            BeamSpec.LineBlob(
                color: Self.recolor(blob.color, with: at(i)),
                sizeW: blob.sizeW, sizeH: blob.sizeH,
                offsetX: blob.offsetX, offsetY: blob.offsetY
            )
        }

        let bloomMap = spec.customColors.lineBloomColorMap
        lineBloom = spec.line.bloomGradients[refKey]!.mapValues { gradients in
            gradients.enumerated().map { i, g in
                guard i < bloomMap.count, let c = BeamRGBA(css: at(bloomMap[i])) else { return g }
                return BeamSpec.BloomGradient(
                    xPct: g.xPct, yOffPx: g.yOffPx, w: g.w, h: g.h,
                    stops: g.stops.map {
                        BeamSpec.BloomStop(r: c.r * 255, g: c.g * 255, b: c.b * 255, a: $0.a, pos: $0.pos)
                    }
                )
            }
        }
    }

    /// Resolves a SwiftUI `Color` to a solid `rgb()` spec string; alpha is
    /// dropped (the beam layers manage their own opacity). Wide-gamut (P3)
    /// components are clamped per channel to the sRGB cube.
    private static func cssString(for color: Color, in environment: EnvironmentValues) -> String {
        let resolved = color.resolve(in: environment)
        let to255 = { (v: Float) in Int((min(max(v, 0), 1) * 255).rounded()) }
        return "rgb(\(to255(resolved.red)), \(to255(resolved.green)), \(to255(resolved.blue)))"
    }

    /// styles.ts `recolor`: swaps a reference color's rgb for a custom one,
    /// keeping the reference alpha (rgba refs stay rgba; rgb refs stay solid).
    private static func recolor(_ ref: String, with rgb: String) -> String {
        guard ref.hasPrefix("rgba"), let a = BeamRGBA(css: ref)?.a else { return rgb }
        return rgb
            .replacingOccurrences(of: "rgb(", with: "rgba(")
            .replacingOccurrences(of: ")", with: ", \(a))")
    }
}
