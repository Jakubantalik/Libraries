import SwiftUI

private struct BeamFrozenTimeKey: EnvironmentKey {
    static let defaultValue: Double? = nil
}

extension EnvironmentValues {
    /// When set, every beam layer renders one deterministic frame at this
    /// absolute time (seconds) at full opacity, instead of animating from a
    /// `TimelineView` clock.
    ///
    /// This exists so snapshot/parity tests can capture a specific frame —
    /// `ImageRenderer` never fires `onAppear`, so without it the fade would sit
    /// at 0 and every capture would be empty. Not part of the public API.
    var beamFrozenTime: Double? {
        get { self[BeamFrozenTimeKey.self] }
        set { self[BeamFrozenTimeKey.self] = newValue }
    }
}
