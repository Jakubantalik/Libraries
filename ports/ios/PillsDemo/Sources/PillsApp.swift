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
    static let orbPillCX: CGFloat = 13 + orbPill / 2
    static let orbSheetCY: CGFloat = 72 + orbSheet / 2

    static let grabW: CGFloat = 36
    static let grabH: CGFloat = 5
    static let grabTop: CGFloat = 12

    // Stacking follows ark-ui's Toast: translate, scale and opacity all
    // transition together over 400ms with --gap 16 between cards, and the
    // enter curve overshoots slightly where the exit curve settles flat.
    static let stackOpacity: [Double] = [1, 0.5, 0.2]
    static let stackGap: CGFloat = 16 // ark --gap
    static let stackShrink: CGFloat = 0.05
    static let stackRendered = 3
    static let enterRise: CGFloat = 90

    static let swipeThreshold: CGFloat = 56
    static let dismissDistance: CGFloat = 90

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

enum EaseKind: String, CaseIterable { case ark, smooth, bounce, spring }

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
    var stack = Seg(ms: 400, bounce: 0.3, ease: .ark, stiffness: 220, damping: 20, mass: 1, anticipate: 0, anticipateMs: 90)
    var open = Seg(ms: 350, bounce: 0.25, ease: .bounce, stiffness: 220, damping: 20, mass: 1, anticipate: 0.04, anticipateMs: 90)
    var close = Seg(ms: 250, bounce: 0.15, ease: .smooth, stiffness: 220, damping: 20, mass: 1, anticipate: 0.05, anticipateMs: 110)
    var revealMs: Double = 500
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
@ViewBuilder
func insetRim(radius: CGFloat) -> some View {
    let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
    ZStack {
        // inset 1px 2px 3px -2px white/0.24
        shape.stroke(Color.white.opacity(0.12), lineWidth: 1)
            .offset(x: 1, y: 2).blur(radius: 2.5)
        // inset -1px -2px 1px -2px white/0.24
        shape.stroke(Color.white.opacity(0.07), lineWidth: 1)
            .offset(x: -1, y: -2).blur(radius: 1.5)
        // inset 0 -2px 1px -2px white/0.24
        shape.stroke(Color.white.opacity(0.07), lineWidth: 1)
            .offset(x: 0, y: -2).blur(radius: 1.5)
    }
    .clipShape(shape)
    .allowsHitTesting(false)
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
    @State private var enterY: CGFloat = 0

    @State private var tune = Tune()

    private var front: PillEntry { stack[stack.length1] }

    var body: some View {
        GeometryReader { geo in
            let sheetW = geo.size.width - D.sheetMargin * 2

            ZStack {
                Color(red: 0x3b / 255.0, green: 0x3b / 255.0, blue: 0x3b / 255.0)
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .onTapGesture(coordinateSpace: .global) { route($0, frame: geo.frame(in: .global)) }

                // receding stack
                ForEach(Array(behind.enumerated()), id: \.element.id) { i, entry in
                    stackPill(entry: entry, depth: behind.count - i)
                }

                surface(sheetW: sheetW, screen: geo.size, globalFrame: geo.frame(in: .global))

                TunePanel(tune: $tune)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(.leading, 16)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(false)
    }

    private var behind: [PillEntry] {
        Array(stack.dropLast().suffix(D.stackRendered))
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
            // glass: gradient pill fades into the opaque sheet fill
            RoundedRectangle(cornerRadius: r, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.black.opacity(0.8), Color.black.opacity(0.16)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .background(
                    // backdrop blur, the design's frosted pill
                    RoundedRectangle(cornerRadius: r, style: .continuous)
                        .fill(.ultraThinMaterial)
                )
                .opacity(Double(1 - min(1, m * 2)))

            RoundedRectangle(cornerRadius: r, style: .continuous)
                .fill(Color.black)
                .opacity(Double(min(1, m * 2)))

            insetRim(radius: r)

            // one orb across both states — travels and scales continuously,
            // drawn at sheet resolution and scaled down for the pill
            ThinkingOrb(state: front.state, size: .px64, theme: .dark, displaySize: D.orbSheet)
                .scaleEffect(D.orbPill / D.orbSheet + (1 - D.orbPill / D.orbSheet) * m)
                .position(
                    x: D.orbPillCX + (w / 2 - D.orbPillCX) * m,
                    y: h / 2 + (D.orbSheetCY - h / 2) * m
                )

            // pill label
            ShimmerText(text: "\(VERBS[front.state] ?? "")....", fontSize: 16)
                .opacity(Double(1 - min(1, m * 3)))
                .position(x: 71.3 + 40, y: D.pillH / 2)

            // grabber
            Capsule()
                .fill(Color.white.opacity(0.22))
                .frame(width: D.grabW, height: D.grabH)
                .opacity(Double(max(0, (m - 0.55) / 0.45)))
                .position(x: sheetW / 2, y: D.grabTop + D.grabH / 2)

            // sheet copy — transitions.dev texts reveal, staggered, 4px blur
            // Positioned by the FINAL sheet width, not the animated `w`:
            // riding the container's bouncy width made the type overshoot
            // sideways with it. The reveal itself stays on the recipe's own
            // ease, so the copy rises smoothly however the surface moves.
            revealText(
                ShimmerText(text: "\(VERBS[front.state] ?? "")....", fontSize: 16),
                window: (0, 1 - D.staggerStep)
            )
            // Measured from the container's BOTTOM, which is pinned: the
            // sheet is bottom-aligned, so the TOP edge is what overshoots on
            // a bouncy open — copy positioned from the top rode that bounce.
            // The reveal itself already runs on the recipe's own ease.
            .position(x: sheetW / 2, y: h - (D.sheetH - 244 - 11))

            revealText(
                Text("Agent is processing your request. Please\nwait, it might take a few seconds.")
                    .font(.system(size: 14))
                    .lineSpacing(8)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color(red: 0x89 / 255.0, green: 0x89 / 255.0, blue: 0x89 / 255.0)),
                window: (D.staggerStep, 1)
            )
            .position(x: sheetW / 2, y: h - (D.sheetH - 277 - 22))
        }
        .frame(width: w, height: h)
        .clipShape(RoundedRectangle(cornerRadius: r, style: .continuous))
        // 0 12px 26px rgba(0,0,0,0.24) — CSS blur 26 is CoreGraphics radius 13
        .shadow(color: .black.opacity(0.24), radius: 13, y: 12)
        .offset(x: swipeX, y: dragY + enterY - lift)
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
                    dragY = max(0, g.translation.height)
                } else {
                    swipeX = g.translation.width
                }
            }
            .onEnded { g in
                if expanded {
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

    @ViewBuilder
    private func stackPill(entry: PillEntry, depth: Int) -> some View {
        StackCard(entry: entry, depth: depth, animation: tune.stack.animation)
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
    let depth: Int
    let animation: Animation

    private var d: CGFloat { CGFloat(depth) }

    private var opacity: Double {
        let stops = D.stackOpacity
        return depth < stops.count ? stops[depth] : 0
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: D.pillR, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Color.black.opacity(0.8), Color.black.opacity(0.16)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .background(
                    RoundedRectangle(cornerRadius: D.pillR, style: .continuous).fill(.ultraThinMaterial)
                )

            ThinkingOrb(state: entry.state, size: .px64, theme: .dark, paused: true, displaySize: D.orbPill)
                .position(x: D.orbPillCX, y: D.pillH / 2)

            Text("\(VERBS[entry.state] ?? "")....")
                .font(.system(size: 16))
                .foregroundStyle(Color(red: 251 / 255.0, green: 251 / 255.0, blue: 251 / 255.0).opacity(0.35))
                .position(x: 71.3 + 40, y: D.pillH / 2)

            insetRim(radius: D.pillR)
        }
        .frame(width: D.pillW, height: D.pillH)
        .clipShape(RoundedRectangle(cornerRadius: D.pillR, style: .continuous))
        .shadow(color: .black.opacity(0.24), radius: 13, y: 12)
        .scaleEffect(1 - d * D.stackShrink)
        .offset(y: -d * D.stackGap)
        .opacity(opacity)
        .allowsHitTesting(false)
        .frame(maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, D.pillBottom)
        // No per-card animation state. Geometry derives from `depth`, and the
        // PUSH is what runs inside withAnimation — SwiftUI then interpolates
        // every card's offset, scale and opacity together, which is how
        // ark-ui's Toast moves a stack. Driving it from onAppear instead does
        // NOT work: that state change is batched into the view's insertion
        // transaction and lands instantly (measured — cards were
        // pixel-identical 1.2s into a 3s animation, deferred or not).
        .transition(.opacity)
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
        withAnimation(tune.stack.animation) {
            stack.append(PillEntry(id: nextId, state: STATES[(i + 1) % STATES.count]))
            if stack.count > D.stackRendered + 2 {
                stack.removeFirst(stack.count - (D.stackRendered + 2))
            }
        }
        nextId += 1
        // the incoming pill rises into place
        enterY = D.enterRise * (1 + tune.stack.anticipate)
        withAnimation(tune.stack.animation) { enterY = 0 }
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
        // wind-up: swell past the sheet, then collapse
        if t.anticipate > 0 {
            withAnimation(.easeOut(duration: t.anticipateMs / 1000)) { morph = 1 + t.anticipate }
            DispatchQueue.main.asyncAfter(deadline: .now() + t.anticipateMs / 1000) {
                withAnimation(t.animation) { morph = 0 }
            }
        } else {
            withAnimation(t.animation) { morph = 0 }
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
            .foregroundStyle(Color(red: 251 / 255.0, green: 251 / 255.0, blue: 251 / 255.0).opacity(0.5))

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

struct TunePanel: View {
    @Binding var tune: Tune
    @State private var openPanel = false
    @State private var seg: SegKey = .stack

    private var cur: Binding<Seg> {
        switch seg {
        case .stack: return $tune.stack
        case .open: return $tune.open
        case .close: return $tune.close
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(openPanel ? "× TUNE" : "≡ TUNE") { openPanel.toggle() }
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

    @ViewBuilder
    private func stepper(
        _ label: String, value: Binding<Double>, step: Double,
        range: ClosedRange<Double>, fmt: @escaping (Double) -> String
    ) -> some View {
        row(label) {
            Button("−") { value.wrappedValue = max(range.lowerBound, value.wrappedValue - step) }
                .buttonStyle(TuneBtn())
            Text(fmt(value.wrappedValue))
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.white)
                .frame(width: 52)
            Button("+") { value.wrappedValue = min(range.upperBound, value.wrappedValue + step) }
                .buttonStyle(TuneBtn())
        }
    }
}

private struct TuneBtn: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, design: .monospaced))
            .foregroundStyle(.white)
            .frame(width: 22, height: 22)
            .background(Circle().fill(Color.white.opacity(configuration.isPressed ? 0.25 : 0.12)))
    }
}
