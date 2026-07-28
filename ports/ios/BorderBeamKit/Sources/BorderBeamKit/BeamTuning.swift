import Foundation

/// Consumer tuning hooks — the SwiftUI equivalent of the web library's CSS
/// custom properties (`--pulse-glow-boost`, `--beam-stroke-opacity`,
/// `--beam-core-blur`, `--beam-glow-brightness`, …), added in border-beam 1.3.0.
///
/// They let an integrator dial a beam's prominence up or down *proportionally*
/// without replacing the effect's internals. The web demo's `pulse-outside`
/// preset, for example, runs `glowBoost 1.05` with `1.71×` layer opacity — which
/// is why an untuned beam looks noticeably softer than the demo.
///
/// ```swift
/// // Roughly the web demo's tuned pulse-outside preset.
/// card.borderBeam(.pulseOutside, tuning: .init(
///     glowBoost: 1.05,
///     strokeOpacity: 1.71, innerOpacity: 1.71, bloomOpacity: 1.71,
///     glowBrightness: 1.3 * 1.71, glowSaturate: 1.2 * 1.71
/// ))
/// ```
public struct BeamTuning: Equatable, Sendable {
    /// Proportional multiplier on the measured per-element glow scale
    /// (`--pulse-glow-boost`). Affects the pulse family's blob geometry.
    public var glowBoost: Double

    /// Multipliers on the stroke / inner / bloom layer opacity
    /// (`--beam-stroke-opacity` and friends). Note the final opacity is still
    /// clamped to 1, exactly as the CSS `opacity` property clamps.
    public var strokeOpacity: Double
    public var innerOpacity: Double
    public var bloomOpacity: Double

    /// Blur radius overrides for the pulse-outside core and bloom layers
    /// (`--beam-core-blur` / `--beam-bloom-blur`). `nil` keeps the preset.
    public var coreBlur: Double?
    public var bloomBlur: Double?

    /// Brightness / saturation overrides for the outward glow layers only
    /// (`--beam-glow-brightness` / `--beam-glow-saturate`). `nil` keeps the
    /// preset. These deliberately do not touch the stroke ring, so the tight
    /// ring and the wide halo stay color-synced.
    public var glowBrightness: Double?
    public var glowSaturate: Double?

    /// Multiplier on the size of `pulse-inner`'s inward glow blobs (the z1
    /// layer, including the corner accents). 1 keeps the spec sizes. Values
    /// below 1 pull the inner wash tighter to the border so it hugs corners
    /// the way the rotate family's (0.9x-derived) inner glow does. iOS-only
    /// tuning hook — the web library has no equivalent custom property yet.
    public var innerSizeScale: Double

    public init(
        glowBoost: Double = 1,
        strokeOpacity: Double = 1,
        innerOpacity: Double = 1,
        bloomOpacity: Double = 1,
        coreBlur: Double? = nil,
        bloomBlur: Double? = nil,
        glowBrightness: Double? = nil,
        glowSaturate: Double? = nil,
        innerSizeScale: Double = 1
    ) {
        self.glowBoost = glowBoost
        self.strokeOpacity = strokeOpacity
        self.innerOpacity = innerOpacity
        self.bloomOpacity = bloomOpacity
        self.coreBlur = coreBlur
        self.bloomBlur = bloomBlur
        self.glowBrightness = glowBrightness
        self.glowSaturate = glowSaturate
        self.innerSizeScale = innerSizeScale
    }

    /// Library defaults — no tuning applied.
    public static let none = BeamTuning()
}
