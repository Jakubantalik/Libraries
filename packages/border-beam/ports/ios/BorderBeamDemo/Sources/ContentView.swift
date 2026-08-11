import SwiftUI
import BorderBeamKit

/// Showcase for BorderBeamKit, mirroring the web demo at beam.jakubantalik.com:
/// every beam type rendered live, with the color variant and theme switchable
/// so all 40 combinations can be eyeballed on device.
struct ContentView: View {
    @State private var variant: BeamColorVariant = .colorful
    @State private var theme: BeamTheme = .dark
    @State private var active = true
    @State private var tuned = false

    private var isDark: Bool { theme != .light }

    var body: some View {
        ZStack {
            (isDark ? Color(white: 0.027) : Color(white: 1.0)).ignoresSafeArea()

            ScrollView {
                VStack(spacing: 34) {
                    header

                    controls

                    ForEach(BeamSize.allCases, id: \.self) { size in
                        BeamSample(
                            size: size,
                            variant: variant,
                            theme: theme,
                            active: active,
                            isDark: isDark,
                            tuning: tuned ? .webDemoPulsePreset : .none
                        )
                    }

                    Text("BorderBeamKit · SwiftUI + Metal")
                        .font(.footnote)
                        .foregroundStyle(secondary.opacity(0.6))
                        .padding(.top, 8)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 28)
            }
        }
        .preferredColorScheme(isDark ? .dark : .light)
        .animation(.easeInOut(duration: 0.25), value: theme)
    }

    private var primary: Color { isDark ? .white : Color(white: 0.1) }
    private var secondary: Color { isDark ? Color(white: 0.62) : Color(white: 0.38) }

    private var header: some View {
        VStack(spacing: 6) {
            Text("Border beam")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(primary)
            Text("Animated border beam component")
                .font(.system(size: 15))
                .foregroundStyle(secondary)
        }
        .padding(.top, 8)
    }

    private var controls: some View {
        VStack(spacing: 14) {
            Picker("Color", selection: $variant) {
                ForEach(BeamColorVariant.allCases, id: \.self) { v in
                    Text(v.rawValue.capitalized).tag(v)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 12) {
                Picker("Theme", selection: $theme) {
                    Text("Dark").tag(BeamTheme.dark)
                    Text("Light").tag(BeamTheme.light)
                    Text("Auto").tag(BeamTheme.auto)
                }
                .pickerStyle(.segmented)

                Toggle("On", isOn: $active)
                    .labelsHidden()
                    .tint(.green)
            }

            Toggle("Web demo tuning (pulse)", isOn: $tuned)
                .font(.system(size: 13))
                .foregroundStyle(secondary)
                .tint(.blue)
        }
    }
}

/// One labelled card wrapped in a beam. `pulse-outside` needs extra room
/// because its halo blooms outside the element's bounds.
private struct BeamSample: View {
    let size: BeamSize
    let variant: BeamColorVariant
    let theme: BeamTheme
    let active: Bool
    let isDark: Bool
    let tuning: BeamTuning

    // Mirrors the web demo's card geometry (348x122, radius 16) so the two
    // can be compared directly.
    private var radius: Double { size == .sm ? 22 : 16 }
    private var height: CGFloat { size == .sm ? 44 : 122 }
    private var width: CGFloat? { size == .sm ? 150 : 348 }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(size.rawValue)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(isDark ? Color(white: 0.55) : Color(white: 0.45))

            BorderBeam(
                size: size,
                colorVariant: variant,
                theme: theme,
                active: active,
                borderRadius: radius,
                tuning: tuning
            ) {
                RoundedRectangle(cornerRadius: radius)
                    .fill(isDark ? Color(white: 0.094) : Color(white: 0.97))
                    .overlay(
                        RoundedRectangle(cornerRadius: radius)
                            .strokeBorder(
                                isDark ? Color(white: 0.22) : Color(white: 0.87),
                                lineWidth: 1
                            )
                    )
                    .frame(width: width, height: height)
                    .overlay(
                        Text(size == .sm ? "Button" : "Build anything…")
                            .font(.system(size: size == .sm ? 14 : 16))
                            .foregroundStyle(isDark ? Color(white: 0.5) : Color(white: 0.55))
                            .padding(.leading, size == .sm ? 0 : 20),
                        alignment: size == .sm ? .center : .topLeading
                    )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            // pulse-outside spills its glow outward; give it breathing room so
            // neighbouring rows don't clip it.
            .padding(.vertical, size == .pulseOutside ? 18 : 0)
        }
    }
}

#Preview {
    ContentView()
}

extension BeamTuning {
    /// The tuning the web demo applies to its `pulse-outside` card
    /// (`.beam-host--pulse-outside-tuned` in demo/src/styles.css): a 1.05x glow
    /// boost with 1.71x layer opacity and matching glow brightness/saturation.
    ///
    /// Without this the beam renders the *library defaults*, which read as
    /// noticeably softer than the demo — the demo is not showing stock output.
    static let webDemoPulsePreset = BeamTuning(
        glowBoost: 1.05,
        strokeOpacity: 1.71,
        innerOpacity: 1.71,
        bloomOpacity: 1.71,
        glowBrightness: 1.3 * 1.71,
        glowSaturate: 1.2 * 1.71
    )
}
