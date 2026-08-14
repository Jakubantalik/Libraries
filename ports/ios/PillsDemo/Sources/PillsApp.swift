// Pills demo — the agent-status pill, native SwiftUI.
//
// The same design and behaviours as the React Native example, rebuilt on
// ThinkingOrbsKit to compare the two side by side on one simulator:
//   - a stack of glass pills bottom-centre; the front one is live, the ones
//     behind recede and keep their content (orb frozen, label muted)
//   - swipe the front pill horizontally to page through the nine orb states
//   - tap the pill: it morphs into the modal sheet — the orb scales up into
//     place and the copy reveals with a staggered blurred rise
//   - drag the sheet down (or flick) to dismiss; tapping outside also closes
//   - tap anywhere outside the pill: a new pill is pushed onto the stack
//   - TUNE panel top-left: per-transition duration/bounce/ease, spring
//     stiffness/damping/mass, anticipation amount and lead-in
//
// Figma geometry (402-wide frame), same constants as the RN build:
//   pill:  213x64  r52.535  bottom 46  orb 48 @ x13  label x71.3
//   sheet: (W-48)x366  r42.54  bottom 24  orb 133 @ y72  title y244
//          subtitle y277 w271 #898989

import SwiftUI
import ThinkingOrbsKit

// MARK: - Design constants

private enum D {
    static let pillW: CGFloat = 213
    static let pillH: CGFloat = 64
    static let pillR: CGFloat = 52.535
    static let pillBottom: CGFloat = 46
    static let sheetH: CGFloat = 366
    static let sheetR: CGFloat = 42.54
    static let sheetBottom: CGFloat = 24
    static let sheetMargin: CGFloat = 24

    static let orbPill: CGFloat = 48
    static let orbSheet: CGFloat = 133
    /// The orb is inset by the SAME gap it has above and below it, so the
    /// pill's padding reads as uniform: (pillH - orbPill) / 2 = 8.
    static let orbPillInset: CGFloat = (pillH - orbPill) / 2
    static let orbPillCX: CGFloat = orbPillInset + orbPill / 2
    /// Figma puts the label 10.3 after the orb; that gap is preserved.
    static let pillLabelX: CGFloat = orbPillInset + orbPill + 10.3
    static let orbSheetCY: CGFloat = 72 + orbSheet / 2

    static let grabW: CGFloat = 36
    static let grabH: CGFloat = 5
    static let grabTop: CGFloat = 12

    // Stacking mirrors the RN example (the source of truth): cards KEEP
    // their content — orb frozen, label muted — and the whole card fades by
    // depth, 1 / 0.5 / 0.2, then to 0 past the window with the same motion.
    // Lift 12, shrink 6% per level; sonner's curve stays as the default ease.
    static let stackOpacity: [Double] = [1, 0.5, 0.2]
    static let stackGap: CGFloat = 12
    static let stackShrink: CGFloat = 0.06
    static let stackRendered = 3
    /// How much a stacked card's overshoot is scaled up, so the bounce is as
    /// readable on a 12pt step as it is on the new pill's 90pt rise.
    static let stackBounceAmp: CGFloat = 4
    static let enterRise: CGFloat = 90
    /// cross-blur on the entering pill, clearing as it lands
    static let enterBlur: CGFloat = 6
    /// the arriving pill's opacity at the start of its rise
    static let enterOpacity: Double = 0.5
    /// how far the sheet carousel throws the orb off-centre
    static let orbSlideOut: CGFloat = 120

    static let swipeThreshold: CGFloat = 56
    static let dismissDistance: CGFloat = 90

    /// Figma type metrics (2584:83691 / 2584:83692), and the SF line
    /// heights they have to be expressed against.
    static let titleLeading: CGFloat = 32.028
    static let subtitleLineHeight: CGFloat = 16.70 // SF 14pt

    static let staggerDistance: CGFloat = 12
    static let staggerStep: Double = 0.08 // fraction of the reveal, ~40ms of 500
    static let revealBlur: CGFloat = 4
}

private let STATES: [OrbState] = [
    .breathing, .working, .searching, .solving, .listening,
    .connecting, .weaving, .composing, .shaping,
]

private let VERBS: [OrbState: String] = [
    .breathing: "Thinking", .working: "Working", .searching: "Searching",
    .solving: "Solving", .listening: "Listening", .connecting: "Connecting",
    .weaving: "Weaving", .composing: "Composing", .shaping: "Shaping",
]

// MARK: - Tuning

enum EaseKind: String, CaseIterable { case sonner, ark, smooth, bounce, spring }

struct Seg {
    var ms: Double
    var bounce: Double
    var ease: EaseKind
    var stiffness: Double
    var damping: Double
    var mass: Double
    var anticipate: Double
    var anticipateMs: Double

    /// The SwiftUI animation this segment describes.
    var animation: Animation {
        switch ease {
        case .sonner:
            // CSS `ease`, sonner's transition curve
            return .timingCurve(0.25, 0.1, 0.25, 1, duration: ms / 1000)
        case .ark:
            // ark-ui Toast's open curve — a slight overshoot at 1.02
            return .timingCurve(0.21, 1.02, 0.73, 1, duration: ms / 1000)
        case .smooth:
            return .timingCurve(0.22, 1, 0.36, 1, duration: ms / 1000)
        case .bounce:
            // transitions.dev plus-menu morph: overshooting arrival
            return .timingCurve(0.34, 1.25 + bounce, 0.64, 1, duration: ms / 1000)
        case .spring:
            return .interpolatingSpring(mass: mass, stiffness: stiffness, damping: damping)
        }
    }
}

struct Tune {
    var stack = Seg(ms: 500, bounce: 0.25, ease: .spring, stiffness: 240, damping: 20, mass: 1, anticipate: 0, anticipateMs: 130)
    var open = Seg(ms: 350, bounce: 0.05, ease: .bounce, stiffness: 220, damping: 20, mass: 1, anticipate: 0.04, anticipateMs: 90)
    var close = Seg(ms: 250, bounce: 0.15, ease: .smooth, stiffness: 220, damping: 20, mass: 1, anticipate: 0.05, anticipateMs: 110)
    var revealMs: Double = 500
    /// Landing dip of the pill on close, in points (plus-menu morph).
    var closeDipPx: Double = 4
}

// MARK: - App

@main
struct PillsApp: App {
    var body: some Scene {
        WindowGroup { PillsView() }
    }
}

    /// The design's three white inset highlights, one spec for pill and sheet:
///
///   inset  1px  2px 3px -2px white/0.24   → bright band along the TOP
///   inset -1px -2px 1px -2px white/0.24   → faint band along the BOTTOM
///   inset  0   -2px 1px -2px white/0.24   → faint band along the BOTTOM
///
/// SwiftUI has no inset-shadow primitive, so each layer is the rounded rect
/// stroked, OFFSET, blurred, and clipped back to the shape.
///
/// The `-2px` SPREAD in the spec is the part that matters: it shrinks each
/// inset before blurring, so what survives is a soft sliver of light near
/// the offset edge — NOT a ring. The first attempt stroked the full
/// perimeter at the raw 0.24 alpha and the pill came out hard-rimmed and
/// glossy, nothing like the Figma render. Approximating the spread by
/// dropping the effective alpha and widening the blur reads right: a faint
/// top-left catchlight, a near-invisible bottom lift.
/// `bottomLight` scales the lower rim: 1 on the pill and the stacked cards,
/// 0 on the sheet, which carries no bottom hairline. The surface passes
/// `1 - morph`, so the light fades out over the morph rather than popping
/// off the instant the sheet state is entered.
@ViewBuilder
func insetRim(radius: CGFloat, bottomLight: Double = 1) -> some View {
    let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
    ZStack {
        // The reference render is lit from BELOW: the readable rim light
        // hugs the bottom arc, and the top carries only a whisper of sheen.
        shape.stroke(Color.white.opacity(0.39 * bottomLight), lineWidth: 0.8)
            .offset(y: -1).blur(radius: 0.3)
            .mask(
                LinearGradient(
                    stops: [.init(color: .clear, location: 0.5), .init(color: .white, location: 1)],
                    startPoint: .top, endPoint: .bottom
                )
            )
        // soft spread above the bottom rim, the glass thickness
        shape.stroke(Color.white.opacity(0.04 * bottomLight), lineWidth: 2)
            .offset(y: -2).blur(radius: 3)
            .mask(
                LinearGradient(
                    stops: [.init(color: .clear, location: 0.55), .init(color: .white, location: 1)],
                    startPoint: .top, endPoint: .bottom
                )
            )
        // faint top sheen
        shape.stroke(Color.white.opacity(0.10), lineWidth: 1)
            .offset(y: 1).blur(radius: 1.5)
            .mask(
                LinearGradient(
                    stops: [.init(color: .white, location: 0), .init(color: .clear, location: 0.4)],
                    startPoint: .top, endPoint: .bottom
                )
            )
    }
    .clipShape(shape)
    .allowsHitTesting(false)
}

/// The call-screen wallpaper look: a frosted photograph, not a clean ramp.
/// A grey-violet base carries several huge blurred bokeh blobs — a silvery
/// haze up top, a warm mauve drift mid-left, a cool violet pool right —
/// then a darker vignette settles the bottom, where the content sits.
private struct FrostedWallpaper: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                LinearGradient(
                    stops: [
                        .init(color: Color(red: 0.60, green: 0.59, blue: 0.66), location: 0),
                        .init(color: Color(red: 0.49, green: 0.46, blue: 0.59), location: 0.55),
                        .init(color: Color(red: 0.34, green: 0.31, blue: 0.45), location: 1),
                    ],
                    startPoint: .top, endPoint: .bottom
                )

                // silvery haze across the upper third
                Ellipse()
                    .fill(Color(red: 0.78, green: 0.78, blue: 0.82).opacity(0.45))
                    .frame(width: w * 1.5, height: h * 0.45)
                    .position(x: w * 0.45, y: h * 0.12)
                    .blur(radius: 70)

                // warm mauve drift, mid-left
                Ellipse()
                    .fill(Color(red: 0.62, green: 0.52, blue: 0.60).opacity(0.55))
                    .frame(width: w * 1.1, height: h * 0.5)
                    .position(x: w * 0.18, y: h * 0.42)
                    .blur(radius: 80)

                // cool violet pool, right of centre
                Ellipse()
                    .fill(Color(red: 0.42, green: 0.38, blue: 0.60).opacity(0.5))
                    .frame(width: w * 1.2, height: h * 0.55)
                    .position(x: w * 0.85, y: h * 0.55)
                    .blur(radius: 90)

                // deep violet vignette pooling at the bottom corners
                Ellipse()
                    .fill(Color(red: 0.22, green: 0.19, blue: 0.33).opacity(0.55))
                    .frame(width: w * 1.8, height: h * 0.55)
                    .position(x: w * 0.5, y: h * 1.08)
                    .blur(radius: 90)

                // faint cool glow behind the lower content area, like the
                // reference's light falling through the frosted pane
                Ellipse()
                    .fill(Color(red: 0.72, green: 0.70, blue: 0.80).opacity(0.22))
                    .frame(width: w * 0.9, height: h * 0.3)
                    .position(x: w * 0.5, y: h * 0.68)
                    .blur(radius: 70)

                // dusty rose breath, top-right — the photo's skin-warmth
                // leaking through the glass
                Ellipse()
                    .fill(Color(red: 0.72, green: 0.58, blue: 0.58).opacity(0.28))
                    .frame(width: w * 0.9, height: h * 0.35)
                    .position(x: w * 0.92, y: h * 0.18)
                    .blur(radius: 75)

                // steel-blue shaft falling diagonally through the mid-field
                Capsule()
                    .fill(Color(red: 0.52, green: 0.56, blue: 0.72).opacity(0.30))
                    .frame(width: w * 1.6, height: h * 0.16)
                    .rotationEffect(.degrees(-18))
                    .position(x: w * 0.55, y: h * 0.5)
                    .blur(radius: 60)

                // periwinkle glint, small and closer to the surface
                Ellipse()
                    .fill(Color(red: 0.70, green: 0.72, blue: 0.88).opacity(0.25))
                    .frame(width: w * 0.5, height: h * 0.14)
                    .rotationEffect(.degrees(-12))
                    .position(x: w * 0.3, y: h * 0.30)
                    .blur(radius: 45)

                // deep plum shoulder, lower-left — asymmetry so the vignette
                // doesn't read as a mirror-symmetric ramp
                Ellipse()
                    .fill(Color(red: 0.24, green: 0.19, blue: 0.32).opacity(0.5))
                    .frame(width: w * 1.0, height: h * 0.45)
                    .rotationEffect(.degrees(14))
                    .position(x: w * 0.08, y: h * 0.92)
                    .blur(radius: 85)

                // cool midnight edge, lower-right, a step bluer than the plum
                Ellipse()
                    .fill(Color(red: 0.18, green: 0.18, blue: 0.34).opacity(0.42))
                    .frame(width: w * 0.9, height: h * 0.4)
                    .rotationEffect(.degrees(-10))
                    .position(x: w * 0.95, y: h * 0.98)
                    .blur(radius: 85)

                // hairline brightening at the very top edge, the pane
                // catching the light
                LinearGradient(
                    stops: [
                        .init(color: Color.white.opacity(0.18), location: 0),
                        .init(color: .clear, location: 0.06),
                    ],
                    startPoint: .top, endPoint: .bottom
                )
            }
            // one offscreen composite: the blobs never repaint, and the huge
            // blurs rasterise once instead of per frame
            .drawingGroup()
        }
        .ignoresSafeArea()
    }
}

struct PillEntry: Identifiable, Equatable {
    let id: Int
    var state: OrbState
}

struct PillsView: View {
    @State private var stack: [PillEntry] = [PillEntry(id: 0, state: .breathing)]
    @State private var nextId = 1
    @State private var expanded = false

    /// 0 = pill, 1 = sheet. Every geometry read derives from this one value,
    /// so the whole morph is a single animated scalar — no matched pairs.
    @State private var morph: CGFloat = 0
    @State private var reveal: CGFloat = 0
    @State private var swipeX: CGFloat = 0
    @State private var dragY: CGFloat = 0
    /// arrival squash after the sheet lands back on the pill
    @State private var closeDip: CGFloat = 0
    /// sheet carousel: horizontal slide of the orb while swiping states
    @State private var orbSlide: CGFloat = 0
    /// axis lock for the sheet drag — nil until the first significant move
    @State private var sheetAxisH: Bool? = nil
    /// Animated stack shift — equals the front entry's id when settled.
    /// Every card's visual depth derives CONTINUOUSLY from this one value
    /// (d = shift - entry.id), the same single-scalar pattern the morph
    /// uses, which is the only animation mechanism in this app that has
    /// never failed. A freshly demoted card's d rides 0 -> 1 without any
    /// per-card state, insertion transition, or onAppear kick — and rapid
    /// pushes stay continuous because ids are birth-ordered.
    @State private var stackShift: CGFloat = 0

    @State private var tune = Tune()

    private var front: PillEntry { stack[stack.length1] }

    /// Boots straight into the sheet so its geometry can be captured with
    /// `simctl io screenshot` alone — no tap needed:
    ///
    ///   SIMCTL_CHILD_START_EXPANDED=1 xcrun simctl launch <device> <bundle>
    ///
    /// (simctl swallows a leading-dash launch argument before the app sees
    /// it, so the env-var form is the one that actually arrives.)
    init() {
        let env = ProcessInfo.processInfo.environment["START_EXPANDED"] != nil
        if env || ProcessInfo.processInfo.arguments.contains("-startExpanded") {
            _expanded = State(initialValue: true)
            _morph = State(initialValue: 1)
            _reveal = State(initialValue: 1)
        }
    }

    var body: some View {
        GeometryReader { geo in
            let sheetW = geo.size.width - D.sheetMargin * 2

            ZStack {
                // Figma 2596:5237's wallpaper. Under a flat fill the pill's
                // frosted material had nothing to sample; the swirl gives the
                // glass something to refract.
                Wallpaper.image
                    .resizable()
                    .scaledToFill()
                    // Pinned to the screen and clipped: a bare scaledToFill
                    // image sizes the ZStack to its own aspect-filled bounds,
                    // which pushed the pill off the right edge.
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .onTapGesture(coordinateSpace: .global) { route($0, frame: geo.frame(in: .global)) }

                // receding stack — front included (hidden) so demotion animates
                ForEach(rendered, id: \.id) { entry in
                    StackCard(entry: entry, shift: stackShift, frontId: front.id)
                }

                surface(sheetW: sheetW, screen: geo.size, globalFrame: geo.frame(in: .global))

                // The sheet copy lives OUTSIDE the morphing surface, in a
                // static layer whose geometry never animates. Inside the
                // surface, every position/frame value is animatable data and
                // interpolates on the MORPH transaction's curve — so however
                // the maths anchored it (top, bottom, final width), a bouncy
                // open bounced the type. Out here nothing is animatable; the
                // only motion is the reveal's own rise, on the recipe's ease.
                sheetCopy(sheetW: sheetW)

            }
        }
        // Full-screen geometry, so sheetBottom / pillBottom are measured from
        // the SCREEN edge rather than from the home-indicator inset. Without
        // this the sheet's visual bottom gap was 24 + ~34 = 58 while its side
        // margins were 24, and the whole design sat too high. route() reads
        // the same frame, so hit-testing follows the shift automatically.
        .ignoresSafeArea()
        // The panel stays OUTSIDE that ignore, so it still clears the status
        // bar; inside it, geo.safeAreaInsets reads 0 and the chip collided
        // with the clock.
        .overlay(alignment: .topLeading) {
            TunePanel(tune: $tune).padding(.leading, 16)
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(false)
        // AUTOPUSH=1 fires a few pushes after launch, so the stacking
        // animation can be captured on video without driving the UI.
        .onAppear {
            guard ProcessInfo.processInfo.environment["AUTOPUSH"] != nil else { return }
            for i in 0..<3 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5 + Double(i) * 1.6) { push() }
            }
        }
    }

    /// Every rendered entry, INCLUDING the front at depth 0. The front's
    /// card sits invisibly under the opaque surface; on push its depth
    /// merely CHANGES 0 -> 1, and depth changes provably interpolate under
    /// the parent's withAnimation. Nothing visible is ever inserted, so
    /// there is no mount jump to fight — the failure mode of both previous
    /// mechanisms (onAppear kicks land inside the insertion transaction and
    /// never animate, measured twice).
    private var rendered: [PillEntry] {
        Array(stack.suffix(D.stackRendered + 1))
    }

    // MARK: static sheet copy (texts reveal)

    @ViewBuilder
    private func sheetCopy(sheetW: CGFloat) -> some View {
        ZStack {
            revealText(
                ShimmerText(text: "\(VERBS[front.state] ?? "")....", fontSize: 16),
                window: (0, 1 - D.staggerStep)
            )
            // carousel: the title dims with the orb's slide, so its content
            // swap happens while it is nearly invisible
            .opacity(1 - 0.9 * Double(min(1, abs(orbSlide) / D.orbSlideOut)))
            .position(x: sheetW / 2, y: 244 + D.titleLeading / 2)

            revealText(
                Text("Agent is processing your request. Please\nwait, it might take a few seconds.")
                    .font(.system(size: 14))
                    // Figma leading is 22 (2584:83692). SwiftUI's lineSpacing
                    // is EXTRA space on top of the font's own line height, so
                    // it is the difference, not the leading — passing 8 gave
                    // 24.7pt lines, measured.
                    .lineSpacing(22 - D.subtitleLineHeight)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color(red: 0x89 / 255.0, green: 0x89 / 255.0, blue: 0x89 / 255.0)),
                window: (D.staggerStep, 1)
            )
            .position(x: sheetW / 2, y: 277 + 22) // two 22pt lines -> centre at +22
        }
        .frame(width: sheetW, height: D.sheetH)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, D.sheetBottom)
        .allowsHitTesting(false)
    }

    // MARK: the morphing surface

    @ViewBuilder
    private func surface(sheetW: CGFloat, screen: CGSize, globalFrame: CGRect) -> some View {
        let m = max(0, min(1, morph))
        let w = D.pillW + (sheetW - D.pillW) * morph
        let h = D.pillH + (D.sheetH - D.pillH) * morph
        let r = D.pillR + (D.sheetR - D.pillR) * m
        let lift = (D.pillBottom - D.sheetBottom) * (1 - m)

        ZStack {
            // glass: gradient pill fades into the opaque sheet fill.
            // Figma 2596:5241: rgba(0,0,0,0.8) -> rgba(0,0,0,0.32) over a
            // 3px backdrop blur — light, so the wallpaper's swirl stays
            // legible through the glass (ultraThinMaterial frosted it out).
            RoundedRectangle(cornerRadius: r, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.black.opacity(0.8), Color.black.opacity(0.32)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .background(
                    BackdropBlur(radius: 3)
                        .clipShape(RoundedRectangle(cornerRadius: r, style: .continuous))
                )
                .opacity(Double(1 - min(1, m * 2)))

            RoundedRectangle(cornerRadius: r, style: .continuous)
                .fill(Color.black)
                .opacity(Double(min(1, m * 2)))

            insetRim(radius: r, bottomLight: Double(1 - m))

            // one orb across both states — travels and scales continuously,
            // drawn at sheet resolution and scaled down for the pill.
            // orbSlide is the sheet carousel: it fades and blurs with the
            // slide, and is gated on m so it can never displace the pill orb.
            ThinkingOrb(state: front.state, size: .px64, theme: .dark, displaySize: D.orbSheet)
                .scaleEffect(D.orbPill / D.orbSheet + (1 - D.orbPill / D.orbSheet) * m)
                .opacity(1 - 0.9 * Double(min(1, abs(orbSlide) / D.orbSlideOut)) * Double(m))
                .blur(radius: min(1, abs(orbSlide) / D.orbSlideOut) * 5 * m)
                .position(
                    x: D.orbPillCX + (w / 2 - D.orbPillCX) * m + orbSlide * m,
                    y: h / 2 + (D.orbSheetCY - h / 2) * m
                )

            // pill label — anchored by its LEADING edge. The old
            // .position(x: 71.3 + 40) centred it on a guessed half-width, so
            // the gap after the orb drifted with the verb's length.
            ShimmerText(text: "\(VERBS[front.state] ?? "")....", fontSize: 16)
                .opacity(Double(1 - min(1, m * 3)))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(.leading, D.pillLabelX)

            // grabber
            Capsule()
                .fill(Color.white.opacity(0.22))
                .frame(width: D.grabW, height: D.grabH)
                .opacity(Double(max(0, (m - 0.55) / 0.45)))
                .position(x: sheetW / 2, y: D.grabTop + D.grabH / 2)

        }
        .frame(width: w, height: h)
        .clipShape(RoundedRectangle(cornerRadius: r, style: .continuous))
        // ONE shadow, per Figma 2596:5241: 0 12px 26px rgba(0,0,0,0.24).
        // The tight contact layer this replaces drew a dark line right under
        // the white hairline — the "black hairline" in the design review.
        .shadow(color: .black.opacity(0.24), radius: 13, y: 12)
        .offset(x: swipeX, y: dragY - lift + closeDip)
        .modifier(EnterBlur(
            shift: stackShift,
            frontId: CGFloat(front.id),
            maxBlur: D.enterBlur,
            startOpacity: D.enterOpacity
        ))
        .modifier(EnterRise(
            shift: stackShift,
            frontId: CGFloat(front.id),
            rise: D.enterRise * (1 + tune.stack.anticipate)
        ))
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, D.sheetBottom)
        // contentShape: the hit region must be the full animated frame — by
        // default only opaque pixels test true, and the drag never claimed.
        // highPriorityGesture: the drag must win over the tap recognisers.
        .contentShape(Rectangle())
        .highPriorityGesture(surfaceGesture(screen: screen))
        // Same router as the background: the surface swallows taps (it holds
        // the drag gesture), so it must route them too — otherwise a pill tap
        // resolved against whichever layer happened to win hit-testing.
        .onTapGesture(coordinateSpace: .global) { route($0, frame: globalFrame) }
    }

    /// One place decides what a tap means, by where it landed — the same
    /// page-coordinate routing the RN build uses. Rects derive from the
    /// GeometryReader's global frame, because a global tap point and
    /// `geo.size` disagree by the safe-area insets — the first build routed
    /// every pill tap as "outside" for exactly that reason.
    private func route(_ loc: CGPoint, frame gf: CGRect) {
        if expanded {
            let sheetTop = gf.maxY - D.sheetBottom - D.sheetH
            let outside = loc.x < gf.minX + D.sheetMargin || loc.x > gf.maxX - D.sheetMargin || loc.y < sheetTop
            if outside { close() }
            return
        }
        let pillLeft = gf.midX - D.pillW / 2
        let pillTop = gf.maxY - D.pillBottom - D.pillH
        let onPill = loc.x > pillLeft - 8 && loc.x < pillLeft + D.pillW + 8
            && loc.y > pillTop - 8 && loc.y < pillTop + D.pillH + 8
        if onPill { open() } else { push() }
    }

    private func surfaceGesture(screen: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { g in
                if expanded {
                    // Lock to the dominant axis at the first significant
                    // movement, or a diagonal drag flip-flops between the
                    // carousel and the dismiss mid-gesture.
                    if sheetAxisH == nil {
                        sheetAxisH = abs(g.translation.width) > abs(g.translation.height)
                    }
                    if sheetAxisH == true {
                        // finger-following with a little resistance
                        orbSlide = g.translation.width * 0.6
                    } else {
                        dragY = max(0, g.translation.height)
                    }
                } else {
                    swipeX = g.translation.width
                }
            }
            .onEnded { g in
                if expanded {
                    let horizontal = sheetAxisH == true
                    sheetAxisH = nil
                    if horizontal {
                        // carousel: slide the orb out, advance, slide the
                        // next in from the other side — the pill swipe's
                        // out-advance-in beat at sheet scale
                        if abs(g.translation.width) > D.swipeThreshold || abs(g.velocity.width) > 500 {
                            let dir: CGFloat = g.translation.width < 0 ? 1 : -1
                            withAnimation(.easeIn(duration: 0.12)) { orbSlide = -dir * D.orbSlideOut }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                                advance(Int(dir))
                                orbSlide = dir * D.orbSlideOut
                                withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.28)) { orbSlide = 0 }
                            }
                        } else {
                            withAnimation(.spring(duration: 0.3)) { orbSlide = 0 }
                        }
                        return
                    }
                    if g.translation.height > D.dismissDistance || g.velocity.height > 800 {
                        close()
                    } else {
                        withAnimation(.spring(duration: 0.35)) { dragY = 0 }
                    }
                    return
                }
                if abs(g.translation.width) > D.swipeThreshold {
                    let dir: CGFloat = g.translation.width < 0 ? 1 : -1
                    let off = screen.width / 2 + D.pillW / 2 + 30
                    withAnimation(.easeIn(duration: 0.14)) { swipeX = -dir * off }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
                        advance(Int(dir))
                        swipeX = dir * off
                        withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.18)) { swipeX = 0 }
                    }
                } else {
                    withAnimation(.spring(duration: 0.35)) { swipeX = 0 }
                }
            }
    }

    /// texts-reveal treatment: rise + fade + 4px cross-blur over a window of
    /// the shared progress — the recipe's per-line delay as one driver
    @ViewBuilder
    private func revealText(_ content: some View, window: (Double, Double)) -> some View {
        let p = max(0, min(1, (Double(reveal) - window.0) / max(0.0001, window.1 - window.0)))
        content
            .opacity(p)
            .blur(radius: (1 - p) * D.revealBlur / 2)
            .offset(y: (1 - p) * D.staggerDistance)
    }

    // MARK: stacked cards

}

/// The new pill's entrance, driven by the SAME animated scalar that recedes
/// the stack. A GeometryEffect re-evaluates per FRAME with the interpolated
/// stackShift; a plain .offset cannot express this rise at all — its rendered
/// endpoints are both 0 (settled before == settled after), so SwiftUI has
/// nothing to interpolate and the pill sits still while its content swaps.
/// frontId is not animatable on purpose: it steps at the commit, which is
/// what drops p to 0 and starts the rise from the bottom.
private struct EnterRise: GeometryEffect {
    var shift: CGFloat
    var frontId: CGFloat
    var rise: CGFloat

    var animatableData: CGFloat {
        get { shift }
        set { shift = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        let p = shift - (frontId - 1) // 0 at push commit, 1 settled
        let y = rise * (1 - max(0, p)) // p > 1 = bounce overshoot above slot
        return ProjectionTransform(CGAffineTransform(translationX: 0, y: y))
    }
}

/// The entering pill's cross-blur and fade, on the same scalar as its rise:
/// it starts soft and half-transparent and is sharp and solid by the time it
/// lands. Animatable for the same reason EnterRise is a GeometryEffect — a
/// plain .blur/.opacity would interpolate between two settled endpoints and
/// never render a frame of the transition.
private struct EnterBlur: ViewModifier, Animatable {
    var shift: CGFloat
    var frontId: CGFloat
    var maxBlur: CGFloat
    var startOpacity: Double

    var animatableData: CGFloat {
        get { shift }
        set { shift = newValue }
    }

    func body(content: Content) -> some View {
        let p = max(0, min(1, shift - (frontId - 1)))
        return content
            .blur(radius: maxBlur * (1 - p))
            .opacity(startOpacity + (1 - startOpacity) * Double(p))
    }
}

/// A card behind the front pill.
///
/// It animates TOWARD its depth rather than being placed at it: a freshly
/// mounted card starts one step nearer the front — exactly where it sat a
/// moment ago as the live pill — so pushing makes the whole stack visibly
/// recede. Without that, SwiftUI mounts the card already at its final depth
/// and the recede never plays, which is what made the stacking read as
/// broken. Offset, scale and opacity move together, as ark-ui's Toast does.
private struct StackCard: View {
    let entry: PillEntry
    /// the parent's animated stack scalar — depth derives per frame inside
    /// StackDepth, never from rendered endpoints
    let shift: CGFloat
    let frontId: Int

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: D.pillR, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.black.opacity(0.8), Color.black.opacity(0.32)], // Figma 2596:5241
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .background(
                    BackdropBlur(radius: 3)
                        .clipShape(RoundedRectangle(cornerRadius: D.pillR, style: .continuous))
                )

            ThinkingOrb(state: entry.state, size: .px64, theme: .dark, paused: true, displaySize: D.orbPill)
                .position(x: D.orbPillCX, y: D.pillH / 2)

            Text("\(VERBS[entry.state] ?? "")....")
                .font(.system(size: 16))
                .foregroundStyle(Color(red: 251 / 255.0, green: 251 / 255.0, blue: 251 / 255.0).opacity(0.35))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(.leading, D.pillLabelX)

            insetRim(radius: D.pillR)
        }
        .frame(width: D.pillW, height: D.pillH)
        .clipShape(RoundedRectangle(cornerRadius: D.pillR, style: .continuous))
        .modifier(StackDepth(shift: shift, entryId: CGFloat(entry.id), frontId: CGFloat(frontId)))
        .allowsHitTesting(false)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, D.pillBottom)
    }
}

/// Depth styling for one stacked card, ALL of it derived per frame from the
/// interpolated stackShift (this modifier is Animatable, so its body re-runs
/// every frame of the transaction).
///
/// Why not plain .opacity/.offset endpoints: the FRONT entry's card must be
/// invisible — it sits exactly under the surface, and at full opacity it is
/// what the user saw as "the top pill stays and only its content changes"
/// (measured on video: the slot pill already showed the NEW label while the
/// surface was still rising). But the moment a card is demoted it must be
/// FULLY visible at the slot. Those two states are the same rendered
/// endpoint (d = 0), so endpoint interpolation cannot express the flip —
/// only a per-frame function of the scalar plus the stepped frontId can:
/// frontId jumps at the commit, so the demoted card is visible from the
/// very first frame while the new front's card goes dark instantly.
private struct StackDepth: ViewModifier, Animatable {
    var shift: CGFloat
    var entryId: CGFloat
    var frontId: CGFloat

    var animatableData: CGFloat {
        get { shift }
        set { shift = newValue }
    }

    private var d: CGFloat { max(0, shift - entryId) }

    /// RN: interpolate(d, [0,1,2,3] -> [1, 0.5, 0.2, 0]), clamped
    private var opacity: Double {
        if entryId == frontId { return 0 }
        let stops: [Double] = [1, 0.5, 0.2, 0]
        let c = max(0, min(CGFloat(stops.count - 1), d))
        let lo = Int(c)
        let hi = min(stops.count - 1, lo + 1)
        return stops[lo] + (stops[hi] - stops[lo]) * Double(c - CGFloat(lo))
    }

    /// Depth with the curve's overshoot amplified.
    ///
    /// The bounce DOES reach these cards — d rides the same overshooting
    /// curve — but a card only travels stackGap (12pt) per push, so a 25%
    /// overshoot is 3pt and reads as nothing, while the new pill's 90pt rise
    /// overshoots by ~22pt and reads clearly. Scaling up only the part of d
    /// that passes its resting depth gives the stack a visible kick without
    /// touching the approach, which still lands exactly on the target.
    private var bouncy: CGFloat {
        let settled = max(0, frontId - entryId)
        return d + max(0, d - settled) * (D.stackBounceAmp - 1)
    }

    func body(content: Content) -> some View {
        content
            // Fades in with depth: at d = 0 the card sits exactly under the
            // surface, and a duplicate drop shadow there doubled the
            // darkness against the Figma render (one shadow, 2584:83680).
            // Opacity reads plain d, not the amplified value — a fade that
            // kicks looks like a flicker.
            .shadow(color: .black.opacity(0.24 * Double(min(1, d))), radius: 13, y: 12)
            .scaleEffect(1 - bouncy * D.stackShrink)
            .offset(y: -bouncy * D.stackGap)
            .opacity(opacity)
    }
}

extension PillsView {

    // MARK: actions

    private func advance(_ dir: Int) {
        let i = STATES.firstIndex(of: front.state) ?? 0
        stack[stack.length1].state = STATES[(i + dir + STATES.count) % STATES.count]
    }

    private func push() {
        let i = STATES.firstIndex(of: front.state) ?? 0
        let id = nextId
        nextId += 1

        // The append commits un-animated; the ONLY animated write is
        // stackShift. Both the demoted card's recede and the new pill's rise
        // derive from that one scalar — the rise through EnterRise, whose
        // animatableData re-evaluates every frame. The previous two-phase
        // enterY (set 90, async animate to 0) kept collapsing: whenever the
        // async block beat the render commit, both writes landed in one
        // update and .offset saw endpoints 0 -> 0 — no motion, content swap
        // only, which is exactly how the bug read on screen.
        var tx = Transaction()
        tx.disablesAnimations = true
        withTransaction(tx) {
            stack.append(PillEntry(id: id, state: STATES[(i + 1) % STATES.count]))
            if stack.count > D.stackRendered + 2 {
                stack.removeFirst(stack.count - (D.stackRendered + 2))
            }
        }
        withAnimation(tune.stack.animation) {
            stackShift = CGFloat(id)
        }
    }

    private func open() {
        expanded = true
        let t = tune.open
        // wind-up: dip slightly below the pill, then expand on the main curve
        if t.anticipate > 0 {
            withAnimation(.easeOut(duration: t.anticipateMs / 1000)) { morph = -t.anticipate }
            DispatchQueue.main.asyncAfter(deadline: .now() + t.anticipateMs / 1000) {
                withAnimation(t.animation) { morph = 1 }
            }
        } else {
            withAnimation(t.animation) { morph = 1 }
        }
        withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: tune.revealMs / 1000).delay(0.12)) {
            reveal = 1
        }
    }

    private func close() {
        expanded = false
        let t = tune.close
        withAnimation(.linear(duration: 0.2)) { reveal = 0 }
        withAnimation(.linear(duration: 0.2)) { dragY = 0 }

        // Wind-up, as originally: swell a touch PAST the sheet, then collapse.
        // The previous version delayed the collapse behind a pre-roll, which
        // is what made the close read as broken — the sheet just sat there
        // for 300ms before anything happened.
        if t.anticipate > 0 {
            withAnimation(.easeOut(duration: t.anticipateMs / 1000)) { morph = 1 + t.anticipate }
            DispatchQueue.main.asyncAfter(deadline: .now() + t.anticipateMs / 1000) {
                withAnimation(t.animation) { morph = 0 }
                runCloseDip(t)
            }
        } else {
            withAnimation(t.animation) { morph = 0 }
            runCloseDip(t)
        }
    }

    /// The pill's landing dip, plus-menu morph: as the collapse arrives the
    /// pill overshoots a few px below its slot and springs back. Separate
    /// from the wind-up above, and tuned in POINTS by ANT PX — driving it
    /// through morph would also shrink the pill's width, since w
    /// interpolates on raw morph.
    private func runCloseDip(_ t: Seg) {
        guard tune.closeDipPx > 0 else { return }
        let flight = (t.ease == .spring ? 0.4 : t.ms / 1000) * 0.6
        DispatchQueue.main.asyncAfter(deadline: .now() + flight) {
            withAnimation(.easeOut(duration: 0.12)) { closeDip = CGFloat(tune.closeDipPx) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(.timingCurve(0.34, 1.4, 0.64, 1, duration: 0.3)) { closeDip = 0 }
            }
        }
    }
}

private extension Array {
    /// last valid index — tiny sugar so `stack[stack.length1]` reads as intent
    var length1: Int { count - 1 }
}

// MARK: - Shimmer text (transitions.dev 15, demo-site values)

struct ShimmerText: View {
    let text: String
    let fontSize: CGFloat

    var body: some View {
        // Driven by TimelineView, NOT by a @State + repeatForever animation.
        // An outer `withAnimation` transaction overrides a child's implicit
        // animation for that update, which silently killed the sweep on the
        // sheet title the moment the reveal ran.
        TimelineView(.animation) { timeline in
            let phase = CGFloat(
                timeline.date.timeIntervalSinceReferenceDate
                    .truncatingRemainder(dividingBy: 2) / 2
            )
            band(phase: phase)
        }
    }

    @ViewBuilder
    private func band(phase: CGFloat) -> some View {
        let base = Text(text)
            .font(.system(size: fontSize))
            // Figma 2584:83691 is a solid #f2f2f2; the shimmer rides above
            // it, so the base sits just under that rather than at half alpha.
            .foregroundStyle(Color(red: 0xf2 / 255.0, green: 0xf2 / 255.0, blue: 0xf2 / 255.0).opacity(0.72))

        // The highlight is the same text in white, masked by a moving band.
        // The overlay stays TEXT-sized and everything inside aligns leading —
        // a centre-aligned mask around the 4x-wide band painted ghost glyphs
        // beside the pill on the first build.
        base.overlay(alignment: .leading) {
            GeometryReader { geo in
                let w = geo.size.width
                Text(text)
                    .font(.system(size: fontSize))
                    .foregroundStyle(.white)
                    .mask(alignment: .leading) {
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0),
                                .init(color: .clear, location: 0.4),
                                .init(color: .white, location: 0.5),
                                .init(color: .clear, location: 0.6),
                                .init(color: .clear, location: 1),
                            ],
                            startPoint: .leading, endPoint: .trailing
                        )
                        // band 400% of the text, sweeping over 2s
                        .frame(width: w * 4)
                        .offset(x: -3 * w * (1 - phase))
                    }
            }
        }
    }
}

// MARK: - Tune panel

private enum SegKey: String, CaseIterable {
    case stack = "new pill"
    case open = "to modal"
    case close = "to pill"
}

/// A dot that replays the segment's own curve on a loop, over a track marked
/// with the resting target. Overshoot pushes it PAST the target mark, so a
/// spring's bounce and settle time are visible without pushing a real pill —
/// which matters most for `spring`, whose stiffness/damping/mass say nothing
/// about how long it actually takes.
private struct CurvePreview: View {
    let seg: Seg

    @State private var travelled = false
    @State private var elapsed: Double = 0
    @State private var started = Date()

    /// Fraction of the track the dot's resting target sits at, leaving room
    /// on the right for an overshoot to be visible.
    private let target: CGFloat = 0.72

    /// A spring has no declared duration; estimate its settle time from the
    /// damped natural frequency so the readout means something.
    private var durationLabel: String {
        switch seg.ease {
        case .spring:
            let wn = (seg.stiffness / seg.mass).squareRoot()
            let zeta = seg.damping / (2 * (seg.stiffness * seg.mass).squareRoot())
            // 2% settling time of a second-order system
            let t = zeta > 0 && zeta < 1 ? 4 / (zeta * wn) : 4 / wn
            return "~\(Int(t * 1000))ms"
        default:
            return "\(Int(seg.ms))ms"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("PREVIEW · tap").font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.4))
                Spacer()
                Text(durationLabel).font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.55))
            }

            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.10)).frame(height: 3)
                    // resting target
                    Rectangle().fill(Color.white.opacity(0.35))
                        .frame(width: 1, height: 12)
                        .offset(x: w * target)
                    Circle().fill(Color.white)
                        .frame(width: 9, height: 9)
                        .offset(x: (travelled ? w * target : 0) - 4.5)
                        .animation(seg.animation, value: travelled)
                }
                .frame(height: 14)
            }
            .frame(height: 14)
        }
        .padding(.top, 2)
        .contentShape(Rectangle())
        .onTapGesture { play() }
    }

    /// One run per tap. Looping made the panel restless while reading the
    /// other values, and a curve is easier to judge when you choose when it
    /// fires. Tapping mid-flight snaps home and re-runs.
    private func play() {
        var tx = Transaction()
        tx.disablesAnimations = true
        withTransaction(tx) { travelled = false }
        DispatchQueue.main.async { travelled = true }
    }
}

struct TunePanel: View {
    @Binding var tune: Tune
    // OPEN_TUNE=1 boots with the panel open (screenshot verification)
    @State private var openPanel = ProcessInfo.processInfo.environment["OPEN_TUNE"] != nil
    // TUNE_SEG=close preselects a tab (screenshot verification)
    @State private var seg: SegKey = SegKey(
        rawValue: ProcessInfo.processInfo.environment["TUNE_SEG"] ?? ""
    ) ?? .stack

    private var cur: Binding<Seg> {
        switch seg {
        case .stack: return $tune.stack
        case .open: return $tune.open
        case .close: return $tune.close
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // labelled so the two demos are distinguishable on one simulator
            // The stamp answers "is this actually my latest build?" at a
            // glance — it is baked at COMPILE time, so an older install can
            // never show a newer date.
            Button(openPanel ? "× TUNE · \(BuildStamp.short)" : "≡ TUNE · \(BuildStamp.short)") { openPanel.toggle() }
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.white.opacity(0.75))
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(Color.black.opacity(0.55)))

            if openPanel {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        ForEach(SegKey.allCases, id: \.self) { k in
                            Button(k.rawValue) { seg = k }
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(seg == k ? .white : .white.opacity(0.5))
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(Capsule().fill(Color.white.opacity(seg == k ? 0.24 : 0.08)))
                        }
                    }

                    row("EASE") {
                        Button(cur.wrappedValue.ease.rawValue) {
                            let all = EaseKind.allCases
                            let i = all.firstIndex(of: cur.wrappedValue.ease) ?? 0
                            cur.wrappedValue.ease = all[(i + 1) % all.count]
                        }
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10).padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.12)))
                    }

                    if cur.wrappedValue.ease == .spring {
                        stepper("STIFF", value: cur.stiffness, step: 20, range: 20...600, fmt: { "\(Int($0))" })
                        stepper("DAMP", value: cur.damping, step: 2, range: 2...60, fmt: { "\(Int($0))" })
                        stepper("MASS", value: cur.mass, step: 0.2, range: 0.2...5, fmt: { String(format: "%.1f", $0) })
                    } else {
                        stepper("DUR", value: cur.ms, step: 50, range: 50...2000, fmt: { "\(Int($0))ms" })
                        stepper("BOUNCE", value: cur.bounce, step: 0.05, range: 0...1, fmt: { String(format: "%.2f", $0) })
                    }
                    stepper("ANTIC", value: cur.anticipate, step: 0.01, range: 0...0.4, fmt: { String(format: "%.2f", $0) })
                    stepper("ANT MS", value: cur.anticipateMs, step: 10, range: 0...500, fmt: { "\(Int($0))ms" })
                    stepper("REVEAL", value: $tune.revealMs, step: 50, range: 100...2000, fmt: { "\(Int($0))ms" })
                    if seg == .close {
                        stepper("ANT PX", value: $tune.closeDipPx, step: 1, range: 0...30, fmt: { "\(Int($0))pt" })
                    }

                    CurvePreview(seg: cur.wrappedValue)

                    Button("reset all") { tune = Tune() }
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.45))
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.black.opacity(0.55)))
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func row(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.white.opacity(0.55))
                .frame(width: 52, alignment: .leading)
            content()
        }
    }

    /// Sliders rather than − / + steppers: on the desktop simulator a drag
    /// is one gesture, a stepper is a click per increment.
    @ViewBuilder
    private func stepper(
        _ label: String, value: Binding<Double>, step: Double,
        range: ClosedRange<Double>, fmt: @escaping (Double) -> String
    ) -> some View {
        row(label) {
            Slider(value: value, in: range, step: step)
                .tint(.white.opacity(0.7))
                .controlSize(.mini)
                .frame(width: 130)
            Text(fmt(value.wrappedValue))
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.white)
                .frame(width: 56, alignment: .trailing)
        }
    }
}
