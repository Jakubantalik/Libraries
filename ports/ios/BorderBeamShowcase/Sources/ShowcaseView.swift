import SwiftUI
import BorderBeamKit

/// Minimal dark showcase mirroring the Figma "Logram" frames (node 2443:1741):
/// four horizontally-swipeable pages, each pairing a beam type with a centered
/// "Border beam" label and a shared page-dot indicator. Edge-beam pages run the
/// beam around the physical screen edge, gradient-masked so only the lower
/// portion shows.
struct ShowcaseView: View {
    // Paged with the iOS 17 ScrollView APIs rather than TabView(.page): the
    // page-style TabView can snap back to its first page on transient
    // re-layouts, while scrollPosition survives them.
    // `-initialPage N` on the launch arguments opens a specific page, so a
    // single beam type can be inspected without swiping there by hand.
    @State private var page: Int? = 0
    /// True from the moment a swipe starts until the pager settles; the
    /// current page's effect fades out (300ms) while this is set.
    @State private var isSwiping = false

    private var current: Int { page ?? 0 }

    private func effectVisible(_ index: Int) -> Bool {
        current == index && !isSwiping
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Showcase.background.ignoresSafeArea()

                ScrollView(.horizontal) {
                    LazyHStack(spacing: 0) {
                        Group {
                            EdgeBeamPage(size: .md, subtitle: "Rotate", active: effectVisible(0)).id(0)
                            EdgeBeamPage(size: .pulseInner, subtitle: "Pulse", active: effectVisible(1)).id(1)
                            EdgeBeamPage(size: .line, subtitle: "Line", active: effectVisible(2)).id(2)
                            ButtonPage(active: effectVisible(3)).id(3)
                        }
                        .containerRelativeFrame(.horizontal)
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: $page)
                .scrollIndicators(.hidden)
                .ignoresSafeArea()
                // Fade the current effect out the moment a swipe starts; the
                // incoming effect fades back in when the pager settles (or the
                // swipe is cancelled and springs back).
                .simultaneousGesture(
                    DragGesture(minimumDistance: 10)
                        .onChanged { _ in isSwiping = true }
                        .onEnded { _ in
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                isSwiping = false
                            }
                        }
                )
                .onChange(of: page) { _, _ in isSwiping = false }
                // Seeding `page` before first layout leaves the ScrollView at
                // page 0, so the jump has to happen once the content exists.
                .onAppear {
                    let target = UserDefaults.standard.integer(forKey: "initialPage")
                    guard target != 0 else { return }
                    DispatchQueue.main.async { page = target }
                }

                PageDots(count: 4, current: current)
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
    /// Corner radius the beams hug. The Figma frame rounds at 56, but the
    /// iPhone 16 Pro's physical display corner radius is 62pt — the hairline
    /// stroke visibly cuts the corner unless it matches the real curve.
    static let screenCornerRadius: Double = 62
    /// Label block center: y 597 + half of the 51pt text block, over 874.
    static let labelY: CGFloat = 622.5 / 874
    /// Height of the bottom-anchored box the pulse/rotate beams wrap, as a
    /// fraction of the screen (the region marked in the design feedback:
    /// from just above the title block down to the bottom edge).
    static let pulseRotateBoxHeight: CGFloat = 0.45
    /// The beam palette sizes its color blobs in card-scale pixels, so drawing
    /// straight onto the screen-sized box leaves most of the border unlit.
    /// Instead the pulse/rotate beams render on a canvas this many times
    /// smaller — card-like, where the blobs nearly close the ring — and the
    /// whole rendering is scaled up to fill the box, keeping the ring
    /// visually continuous like the web demo card. Rotate condenses harder;
    /// pulse keeps the smaller glow size of the original tuning.
    static let pulseBeamScale: CGFloat = 2.0
    static let rotateBeamScale: CGFloat = 2.6
    /// Per-type beam durations. Rotate runs 30% slower than its 1.96s spec
    /// default (mirrored copy off-phase); pulse breathes 40% slower than its
    /// 2.3s default.
    static func beamDuration(for size: BeamSize, mirrored: Bool) -> Double? {
        switch size {
        case .md: return mirrored ? 3.6 : 2.8
        case .pulseInner: return 3.8
        default: return nil
        }
    }
    /// Rotate's hue ping-pong stays within ±30° by default, which reads as a
    /// narrow slice of the colorful palette; widening it sweeps the full
    /// spectrum over the 12s hue period.
    static let rotateHueRange: Double = 120
    /// The line beam anchors everything to the box's bottom edge, so it can
    /// afford a taller box; its whole effect is scaled up 40% instead.
    static let lineBoxHeight: CGFloat = 0.45
    static let lineScale: CGFloat = 1.8
    /// Swipe transition: the outgoing effect fades out over this duration the
    /// moment the drag starts; the incoming one fades in when the pager lands.
    static let effectFadeSeconds: Double = 0.3
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
    /// False while the page is off-screen or a swipe is in flight; drives the
    /// 300ms fade of the beam stack (the label stays put).
    let active: Bool

    private var isLine: Bool { size == .line }
    private var boxHeight: CGFloat {
        isLine ? Showcase.lineBoxHeight : Showcase.pulseRotateBoxHeight
    }
    /// Every beam draws on a shrunken canvas and is scaled back up to the box,
    /// which both enlarges the effect and — because the canvas radius is the
    /// screen radius divided by the same factor — lands the canvas corners
    /// exactly on the phone's corners, so the wrapped glow follows them.
    private var renderScale: CGFloat {
        if isLine { return Showcase.lineScale }
        return size == .md ? Showcase.rotateBeamScale : Showcase.pulseBeamScale
    }
    private var canvasShrink: CGFloat { renderScale }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Group {
                    beamLayer(in: geo.size, mirrored: false)
                    // Rotate gets a second, horizontally mirrored and
                    // desynced instance: two counter-sweeping arcs. Pulse
                    // stays single — doubled up it reads as a dense wall of
                    // color rather than distinct breathing glows.
                    if size == .md {
                        beamLayer(in: geo.size, mirrored: true)
                    }
                }
                // The web demo card clips its beam with `overflow: hidden`;
                // without the equivalent here the corner glow spills past the
                // display's rounded corners and reads as a square edge.
                // Circular style matches the shader ring's geometry, so the
                // clip never shaves the hairline stroke at the corners.
                .clipShape(RoundedRectangle(cornerRadius: Showcase.screenCornerRadius))
                .opacity(active ? 1 : 0)
                .animation(.easeInOut(duration: Showcase.effectFadeSeconds), value: active)

                PageLabel(subtitle: subtitle)
                    .position(x: geo.size.width / 2, y: geo.size.height * Showcase.labelY)
            }
        }
        .ignoresSafeArea()
    }

    private func beamLayer(in screen: CGSize, mirrored: Bool) -> some View {
        BorderBeam(
            size: size,
            colorVariant: .colorful,
            theme: .dark,
            // Desync the mirrored copy so the two breathe/sweep out of phase.
            duration: Showcase.beamDuration(for: size, mirrored: mirrored),
            borderRadius: Showcase.screenCornerRadius / canvasShrink,
            // The rotate arc reads faint at screen-edge scale; lift it
            // the same way the pulse pages are lifted by their tuning.
            brightness: size == .md ? 1.5 : nil,
            saturation: size == .md ? 1.35 : nil,
            hueRange: size == .md ? Showcase.rotateHueRange : 30,
            tuning: size.isPulse ? .showcasePulse : .none
        ) {
            Color.clear
        }
        .mask(bottomFade)
        .frame(
            width: screen.width / canvasShrink,
            height: screen.height * boxHeight / canvasShrink
        )
        .scaleEffect(
            x: mirrored ? -renderScale : renderScale,
            y: renderScale,
            anchor: .bottom
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
    }

    /// Fades the top of the beam box to nothing, hiding its top edge so the
    /// beam reads as emerging from the bottom of the screen.
    private var bottomFade: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: .clear, location: 0.08),
                .init(color: .white, location: isLine ? 0.55 : 0.38),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

/// "Search or ask" pill with a pulse-outside beam, anchored near the bottom.
private struct ButtonPage: View {
    let active: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack {
                PageLabel(subtitle: "Button")
                    .position(x: geo.size.width / 2, y: geo.size.height * Showcase.labelY)

                SearchPill(active: active)
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
    /// Fades only the beam (300ms, in sync with the edge pages); the pill
    /// itself stays visible like the page labels do.
    let active: Bool

    private let radius: Double = 26

    var body: some View {
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
            .overlay {
                BorderBeam(
                    size: .pulseInner,
                    colorVariant: .colorful,
                    theme: .dark,
                    borderRadius: radius
                ) {
                    Color.clear
                }
                .opacity(active ? 1 : 0)
                .animation(.easeInOut(duration: Showcase.effectFadeSeconds), value: active)
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
    /// The web demo's tuned pulse preset (`--pulse-glow-boost` and friends in
    /// demo/src/styles.css). Without it the beam renders the library defaults,
    /// which read noticeably softer than the demo.
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

#Preview("Pulse page") {
    EdgeBeamPage(size: .pulseInner, subtitle: "Pulse", active: true)
        .background(Showcase.background)
}
