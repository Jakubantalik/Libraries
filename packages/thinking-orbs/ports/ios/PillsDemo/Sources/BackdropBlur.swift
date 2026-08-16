// A backdrop blur with a CONTROLLABLE radius (Figma 2596:5241: 3px).
//
// SwiftUI's materials don't expose a radius, and ultraThinMaterial reads
// far heavier than the design's 3px — the wallpaper's swirl vanished into
// frosted mush behind the pill. UIKit's trick: put a UIVisualEffectView's
// effect inside a paused UIViewPropertyAnimator and park fractionComplete
// partway, which scales the blur down proportionally. fraction ~ radius/20
// approximates a UIBlurEffect(.regular)'s full strength.

import SwiftUI
import UIKit

struct BackdropBlur: UIViewRepresentable {
    var radius: CGFloat

    func makeUIView(context: Context) -> TunableBlurView {
        TunableBlurView(radius: radius)
    }

    func updateUIView(_ view: TunableBlurView, context: Context) {
        view.setRadius(radius)
    }
}

final class TunableBlurView: UIView {
    private let effectView = UIVisualEffectView(effect: nil)
    private var animator: UIViewPropertyAnimator?

    init(radius: CGFloat) {
        super.init(frame: .zero)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(effectView)
        NSLayoutConstraint.activate([
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
        setRadius(radius)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func setRadius(_ radius: CGFloat) {
        animator?.stopAnimation(true)
        effectView.effect = nil
        let a = UIViewPropertyAnimator(duration: 1, curve: .linear) { [effectView] in
            effectView.effect = UIBlurEffect(style: .regular)
        }
        a.fractionComplete = min(1, radius / 20)
        // paused forever on purpose; stopping it would snap to full blur
        a.pausesOnCompletion = true
        animator = a
    }

    deinit {
        animator?.stopAnimation(true)
    }
}
