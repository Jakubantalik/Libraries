import SwiftUI
import BorderBeamKit

/// Minimal dark showcase mirroring the Figma "Logram" frames (node 2443:1741):
/// four horizontally-swipeable pages, each pairing a beam type with a centered
/// "Border beam" label and a shared page-dot indicator. Edge-beam pages run the
/// beam around the physical screen edge, gradient-masked so only the lower
/// portion shows.
struct ShowcaseView: View {
    @State private var page = 0

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Showcase.background.ignoresSafeArea()

                TabView(selection: $page) {
                    EdgeBeamPage(size: .pulseInner, subtitle: "Pulse").tag(0)
                    EdgeBeamPage(size: .line, subtitle: "Line").tag(1)
                    ButtonPage().tag(2)
                    EdgeBeamPage(size: .md, subtitle: "Rotate").tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .ignoresSafeArea()

                PageDots(count: 4, current: page)
                    .position(x: geo.size.width / 2, y: geo.size.height * Showcase.dotsY)
            }
        }
        .ignoresSafeArea()
        .preferredColorScheme(.dark)
    }
}

/// Layout constants lifted from the Figma frames (402x874, iPhone 16/17 Pro).
private enum Showcase {
    static let background = Color(red: 0x07 / 255, green: 0x07 / 255, blue: 0x07 / 255)
    /// Corner radius of the device-frame rounded rect the beams hug.
    static let screenCornerRadius: Double = 56
    /// Label block center: y 597 + half of the 51pt text block, over 874.
    static let labelY: CGFloat = 622.5 / 874
    /// Height of the bottom-anchored box the edge beams wrap, as a fraction of
    /// the screen. The beam palette positions its color blobs at fractions of
    /// the wrapped element with card-scale pixel sizes, so wrapping the whole
    /// screen leaves most of the border unlit (and puts the right-edge blobs
    /// up in the faded-out zone). A shorter box keeps the visible U — left,
    /// bottom, right — fully covered.
    static let beamBoxHeight: CGFloat = 0.45
    /// Dot row center: y 684 + 4, over 874.
    static let dotsY: CGFloat = 688 / 874
    /// Pill center: y 772 + 26, over 874 — kept as a distance from the bottom
    /// so it tracks the home indicator on taller screens.
    static let pillBottomOffset: CGFloat = 874 - 798
}

/// Full-screen beam running along the display edge, faded out toward the top.
private struct EdgeBeamPage: View {
    let size: BeamSize
    let subtitle: String

    var body: some View {
        GeometryReader { geo in
            ZStack {
                BorderBeam(
                    size: size,
                    colorVariant: .colorful,
                    theme: .dark,
                    borderRadius: Showcase.screenCornerRadius,
                    tuning: size.isPulse ? .showcasePulse : .none
                ) {
                    Color.clear
                }
                .mask(bottomFade)
                .frame(height: geo.size.height * Showcase.beamBoxHeight)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                PageLabel(subtitle: subtitle)
                    .position(x: geo.size.width / 2, y: geo.size.height * Showcase.labelY)
            }
        }
        .ignoresSafeArea()
    }

    /// Fades the top of the beam box to nothing, hiding its top edge so the
    /// beam reads as emerging from the bottom of the screen.
    private var bottomFade: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: .clear, location: 0.12),
                .init(color: .white, location: 0.55),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

/// "Search or ask" pill with a pulse-outside beam, anchored near the bottom.
private struct ButtonPage: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                PageLabel(subtitle: "Button")
                    .position(x: geo.size.width / 2, y: geo.size.height * Showcase.labelY)

                SearchPill()
                    .position(
                        x: geo.size.width / 2,
                        y: geo.size.height - Showcase.pillBottomOffset
                    )
            }
        }
        .ignoresSafeArea()
    }
}

private struct SearchPill: View {
    private let radius: Double = 26

    var body: some View {
        BorderBeam(
            size: .pulseInner,
            colorVariant: .colorful,
            theme: .dark,
            borderRadius: radius
        ) {
            RoundedRectangle(cornerRadius: radius)
                .fill(Color(red: 0x1D / 255, green: 0x1D / 255, blue: 0x1D / 255))
                .overlay(
                    RoundedRectangle(cornerRadius: radius)
                        .strokeBorder(
                            Color(red: 44 / 255, green: 47 / 255, blue: 54 / 255)
                                .opacity(0.52),
                            lineWidth: 1.26
                        )
                )
                .overlay(alignment: .leading) {
                    Text("Search or ask")
                        .font(.system(size: 19))
                        .foregroundStyle(Color(white: 0x55 / 255))
                        .padding(.leading, 21)
                }
                .frame(width: 302, height: 52)
        }
    }
}

private struct PageLabel: View {
    let subtitle: String

    var body: some View {
        VStack(spacing: 4) {
            Text("Border beam")
                .font(.system(size: 20))
                .foregroundStyle(Color(white: 0xF0 / 255))
            Text(subtitle)
                .font(.system(size: 16))
                .foregroundStyle(Color(red: 0xCA / 255, green: 0xCA / 255, blue: 0xCA / 255).opacity(0.5))
        }
    }
}

private struct PageDots: View {
    let count: Int
    let current: Int

    var body: some View {
        HStack(spacing: 11.5) {
            ForEach(0..<count, id: \.self) { i in
                Circle()
                    .fill(.white.opacity(i == current ? 1 : 0.3))
                    .frame(width: 8, height: 8)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: current)
    }
}

extension BeamTuning {
    /// The web demo's tuned pulse preset (see `--pulse-glow-boost` and friends
    /// in demo/src/styles.css): 1.71x layer opacity with matching glow
    /// brightness/saturation, so the pulse reads as vividly as the web demo
    /// instead of the softer library defaults.
    static let showcasePulse = BeamTuning(
        glowBoost: 1.05,
        strokeOpacity: 1.71,
        innerOpacity: 1.71,
        bloomOpacity: 1.71,
        glowBrightness: 1.3 * 1.71,
        glowSaturate: 1.2 * 1.71
    )
}

#Preview {
    ShowcaseView()
}
