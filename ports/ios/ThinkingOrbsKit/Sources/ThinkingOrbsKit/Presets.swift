// Resolves a (state, size) pair to its mode + fully-scaled draw options.
// Transcribed from src/presets.ts and src/engine/profiles.ts; the tuning
// numbers themselves live in the generated OrbSpec.swift.

import Foundation

public struct ResolvedPreset: Sendable {
    let mode: OrbMode
    public let speed: Double
    let opts: [String: Double]
}

private func scaleCounts(_ opts: [String: Double], _ scale: Double) -> [String: Double] {
    var out = opts
    var done = Set<String>()
    let rt = scale.squareRoot()
    for (a, b) in OrbSpec.countPairs {
        if let va = out[a], let vb = out[b], !done.contains(a), !done.contains(b) {
            out[a] = Swift.max(2, (va * rt).rounded(.toNearestOrAwayFromZero))
            out[b] = Swift.max(2, (vb * rt).rounded(.toNearestOrAwayFromZero))
            done.insert(a); done.insert(b)
        }
    }
    for k in OrbSpec.countKeys {
        // 0 means the mode opted out of that layer entirely (ring has no
        // ghost sphere) — scaling must not resurrect it as a single stray dot
        if let v = out[k], v != 0, !done.contains(k) {
            out[k] = Swift.max(1, (v * scale).rounded(.toNearestOrAwayFromZero))
        }
    }
    for k in OrbSpec.iconDensityKeys {
        if let v = out[k] { out[k] = Swift.max(0.02, v * scale) }
    }
    return out
}

private func scaleRadii(_ opts: [String: Double], _ scale: Double) -> [String: Double] {
    var out = opts
    for k in OrbSpec.radiusKeys {
        if let v = out[k] { out[k] = v * scale }
    }
    out["rSizeMul"] = (out["rSizeMul"] ?? 1) * scale
    return out
}

private let cacheLock = NSLock()
nonisolated(unsafe) private var cache: [String: ResolvedPreset] = [:]

/// Resolve a (state, size) pair. Cached: the result is identical for the
/// lifetime of the process, and the render loop should never do this work.
public func resolvePreset(_ state: OrbState, _ size: OrbSize) -> ResolvedPreset {
    let key = "\(state.rawValue)-\(size.rawValue)"
    cacheLock.lock()
    defer { cacheLock.unlock() }
    if let hit = cache[key] { return hit }

    let mode = state.mode
    let preset = OrbSpec.presets[mode]![size]!
    var opts = OrbSpec.baseProfiles[mode]!
    if preset.count != 1 { opts = scaleCounts(opts, preset.count) }
    if preset.size != 1 { opts = scaleRadii(opts, preset.size) }
    for (k, v) in preset.extra { opts[k] = v }

    let resolved = ResolvedPreset(mode: mode, speed: preset.speed, opts: opts)
    cache[key] = resolved
    return resolved
}

/// Geometry for one instant. Mirrors MODE_FRAMES in the TS engine.
public func orbFrame(_ preset: ResolvedPreset, size: Double, t: Double) -> OrbFrame {
    let o = preset.opts
    switch preset.mode {
    case .orbits: return frameOrbits(size, t, o)
    case .globe: return frameGlobe(size, t, o)
    case .rubik: return frameRubik(size, t, o)
    case .wave: return frameWave(size, t, o)
    case .web: return frameWeb(size, t, o)
    case .braid: return frameBraid(size, t, o)
    // ring shares ribbon's geometry — the `faceOn` profile flag switches it
    case .ribbon, .ring: return frameRibbon(size, t, o)
    case .morph: return frameMorph(size, t, o)
    }
}

/// Convenience: resolve and build in one call.
public func orbFrame(state: OrbState, size: OrbSize, t: Double) -> OrbFrame {
    orbFrame(resolvePreset(state, size), size: size.value, t: t)
}
