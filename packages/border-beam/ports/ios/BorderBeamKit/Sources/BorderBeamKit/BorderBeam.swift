import SwiftUI

/// Animated border beam effect — SwiftUI port of the `border-beam` web library.
///
/// ```swift
/// BorderBeam(size: .md) {
///     Card()
/// }
/// // or
/// Card().borderBeam(.md, colorVariant: .ocean)
/// ```
///
/// Rendering matches the web version layer-for-layer: an inner glow layer, a
/// stroke ring layer window-masked by a rotating conic gradient, and a blurred
/// bloom ring — all drawn by the `beamRotateLayer` Metal shader from data in
/// the shared `beam-spec.json`.
public struct BorderBeam<Content: View>: View {
    private let size: BeamSize
    private let colorVariant: BeamColorVariant
    private let theme: BeamTheme
    private let staticColors: Bool
    private let duration: Double?
    private let active: Bool
    private let borderRadius: Double?
    private let brightness: Double?
    private let saturation: Double?
    private let hueRange: Double
    private let strength: Double
    private let tuning: BeamTuning
    private let onActivate: (() -> Void)?
    private let onDeactivate: (() -> Void)?
    private let content: Content

    @Environment(\.colorScheme) private var colorScheme
    /// Web parity: only the pulse family honors reduced motion.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Time-based fade evaluated per-frame in the layers' TimelineViews.
    @State private var fade: BeamFade = .hidden
    /// Keeps layers mounted while fading out. Seeded from `active` so a render
    /// that never delivers `onAppear` (e.g. `ImageRenderer`) still draws.
    @State private var mounted: Bool

    public init(
        size: BeamSize = .md,
        colorVariant: BeamColorVariant = .colorful,
        theme: BeamTheme = .dark,
        staticColors: Bool = false,
        duration: Double? = nil,
        active: Bool = true,
        borderRadius: Double? = nil,
        brightness: Double? = nil,
        saturation: Double? = nil,
        hueRange: Double = 30,
        strength: Double = 1,
        tuning: BeamTuning = .none,
        onActivate: (() -> Void)? = nil,
        onDeactivate: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.size = size
        self.colorVariant = colorVariant
        self.theme = theme
        self.staticColors = staticColors
        self.duration = duration
        self.active = active
        self.borderRadius = borderRadius
        self.brightness = brightness
        self.saturation = saturation
        self.hueRange = hueRange
        self.strength = strength
        self.tuning = tuning
        self.onActivate = onActivate
        self.onDeactivate = onDeactivate
        self.content = content()
        _mounted = State(initialValue: active)
    }

    public var body: some View {
        content
            .background {
                // pulse-outside core + bloom glow behind the content
                // (web z-index -1; the wrapped child must be opaque).
                if mounted, size == .pulseOutside {
                    PulseBeamLayers(config: pulseConfig, fade: fade, part: .glow)
                        .allowsHitTesting(false)
                }
            }
            .overlay {
                if mounted {
                    beamOverlay.allowsHitTesting(false)
                }
            }
            .onAppear { if active { setActive(true) } }
            .onChange(of: active) { _, nowActive in setActive(nowActive) }
    }

    // MARK: - Lifecycle (fade in/out, web parity: 0.6 s in / 0.5 s out, ease)

    private func setActive(_ on: Bool) {
        let spec = BeamSpec.shared
        let now = Date()
        let current = fade.value(at: now)
        if on {
            mounted = true
            let duration = spec.defaults.fadeInSeconds
            fade = BeamFade(from: current, target: 1, start: now, duration: duration)
            DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                if fade.target == 1 { onActivate?() }
            }
        } else {
            let duration = spec.defaults.fadeOutSeconds
            fade = BeamFade(from: current, target: 0, start: now, duration: duration)
            DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                if fade.target == 0 {
                    mounted = false
                    onDeactivate?()
                }
            }
        }
    }

    // MARK: - Overlay dispatch

    @ViewBuilder
    private var beamOverlay: some View {
        switch size {
        case .sm, .md:
            RotateBeamLayers(config: rotateConfig, fade: fade)
        case .line:
            LineBeamLayers(config: lineConfig, fade: fade)
        case .pulseInner:
            PulseBeamLayers(config: pulseConfig, fade: fade, part: .all)
        case .pulseOutside:
            PulseBeamLayers(config: pulseConfig, fade: fade, part: .stroke)
        }
    }

    private var resolvedTheme: String {
        switch theme {
        case .dark: return "dark"
        case .light: return "light"
        case .auto: return colorScheme == .dark ? "dark" : "light"
        }
    }

    private var finalStaticColors: Bool {
        colorVariant == .mono ? true : staticColors
    }

    private var rotateConfig: RotateBeamConfig {
        RotateBeamConfig(
            size: size,
            variant: colorVariant,
            theme: resolvedTheme,
            staticColors: finalStaticColors,
            duration: duration ?? BeamSpec.shared.defaults.duration.rotate,
            borderRadius: borderRadius,
            brightness: brightness,
            saturation: saturation,
            hueRange: hueRange,
            strength: min(max(strength, 0), 1)
        )
    }

    private var lineConfig: LineBeamConfig {
        let spec = BeamSpec.shared
        return LineBeamConfig(
            variant: colorVariant,
            theme: resolvedTheme,
            staticColors: finalStaticColors,
            duration: duration ?? spec.defaults.duration.line,
            borderRadius: borderRadius,
            brightness: brightness,
            saturation: saturation,
            // The line family caps the hue range at 13° (web parity).
            hueRange: min(hueRange, spec.defaults.lineHueRangeCap),
            strength: min(max(strength, 0), 1)
        )
    }

    private var pulseConfig: PulseBeamConfig {
        PulseBeamConfig(
            size: size,
            variant: colorVariant,
            theme: resolvedTheme,
            staticColors: finalStaticColors,
            duration: duration ?? BeamSpec.shared.defaults.duration.pulse,
            borderRadius: borderRadius,
            brightness: brightness,
            saturation: saturation,
            strength: min(max(strength, 0), 1),
            // Web parity: only the pulse family honors reduced motion.
            reduceMotion: reduceMotion,
            tuning: tuning
        )
    }
}

// MARK: - View modifier sugar

public extension View {
    /// Wraps the view in a ``BorderBeam``.
    func borderBeam(
        _ size: BeamSize = .md,
        colorVariant: BeamColorVariant = .colorful,
        theme: BeamTheme = .dark,
        staticColors: Bool = false,
        duration: Double? = nil,
        active: Bool = true,
        borderRadius: Double? = nil,
        brightness: Double? = nil,
        saturation: Double? = nil,
        hueRange: Double = 30,
        strength: Double = 1,
        tuning: BeamTuning = .none,
        onActivate: (() -> Void)? = nil,
        onDeactivate: (() -> Void)? = nil
    ) -> some View {
        BorderBeam(
            size: size,
            colorVariant: colorVariant,
            theme: theme,
            staticColors: staticColors,
            duration: duration,
            active: active,
            borderRadius: borderRadius,
            brightness: brightness,
            saturation: saturation,
            hueRange: hueRange,
            strength: strength,
            tuning: tuning,
            onActivate: onActivate,
            onDeactivate: onDeactivate
        ) { self }
    }
}
