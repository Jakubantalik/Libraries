// The strand modes: braid (weaving), ribbon (composing) and ring
// (breathing). Transcribed from src/engine/braid.ts and ribbon.ts.

import Foundation

// --- Braid: three strands plait around the sphere — weaving -----------

func frameBraid(_ size: Double, _ t: Double, _ o: [String: Double]) -> OrbFrame {
    let cx = size / 2
    let cy = size / 2
    let R = (size / 2) * 0.76
    let pt = Projector(yaw: t * 0.4, tilt: 0.3, cx: cx, cy: cy, scale: 1)
    let rs = radiusScale(size, pow: o["rsPow"] ?? 0.6)

    var dots: [Dot] = []
    let ghostN = Int(o["ghostN"] ?? 150)
    for i in 0..<ghostN {
        let d = fibDir(i, ghostN)
        let (px, py, z) = pt(d.0 * R, d.1 * R, d.2 * R)
        let depth = (z / R + 1) / 2
        dots.append(Dot(x: px, y: py, z: z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth))
    }

    let strandN = Int(o["strandN"] ?? 52)
    let turns = o["turns"] ?? 3
    for s in 0..<3 {
        let phase = (Double(s) / 3) * 2 * Double.pi
        for i in 0..<strandN {
            // u walks pole to pole; the frac() drift slides the whole strand along
            let u = (frac(Double(i) / Double(strandN) + t * 0.045) * 2 - 1) * 0.96
            let surf = Swift.max(0, 1 - u * u).squareRoot()
            let endFade = Swift.min(1, (1 - abs(u)) / 0.1)
            let a = u * Double.pi * turns + phase
            // radial breathing: strands trade places — the over/under of a plait
            let weave = 1 + 0.075 * sin(u * Double.pi * turns * 2 + phase * 2 + t * 0.8)
            let rr = surf * R * weave
            let (px, py, zr) = pt(cos(a) * rr, u * R * weave, sin(a) * rr)
            let depth = (zr / R + 1) / 2
            dots.append(Dot(
                x: px, y: py, z: zr,
                r: ((o["rBase"] ?? 1.2) + (o["rDepth"] ?? 1.8) * depth) * rs,
                white: 0.55 - 0.45 * depth,
                a: endFade * (0.45 + 0.55 * depth)
            ))
        }
    }
    return finalizeFrame(dots, [], rMin: o["rMin"] ?? 0.3)
}

// --- Ribbon: an undulating sash orbits the sphere — composing ---------
// The same geometry drives "breathing" (ring) via the `faceOn` flag: a
// face-on circle whose RADIUS undulates rather than its out-of-plane
// offset, so it reads as a ring slowly morphing rather than a sash.

func frameRibbon(_ size: Double, _ t: Double, _ o: [String: Double]) -> OrbFrame {
    let cx = size / 2
    let cy = size / 2
    let R = (size / 2) * 0.78
    // spin scales the 3D tumble; spin=0 freezes the band's orientation,
    // leaving only the traveling undulation
    let spin = o["spin"] ?? 1
    let camTilt = 0.3
    let faceOn = (o["faceOn"] ?? 0) != 0
    let pt = Projector(yaw: t * 0.1 * spin, tilt: camTilt, cx: cx, cy: cy, scale: 1)
    let rs = radiusScale(size, pow: o["rsPow"] ?? 0.6)

    var dots: [Dot] = []
    let ghostN = Int(o["ghostN"] ?? 150)
    if ghostN > 0 {
        for i in 0..<ghostN {
            let d = fibDir(i, ghostN)
            let (px, py, z) = pt(d.0 * R, d.1 * R, d.2 * R)
            let depth = (z / R + 1) / 2
            dots.append(Dot(x: px, y: py, z: z, r: 0.8 * rs, white: 0.78, a: 0.1 + 0.22 * depth))
        }
    }

    // The band plane, precessing (frozen when spin=0). The projection squashes
    // the band's great circle vertically by cos(ta + camTilt); face-on sets
    // ta = -camTilt so that term is 1 and the band reads as a true circle
    // rather than ribbon's tilted ellipse.
    let ya = t * 0.24 * spin
    let ta = faceOn ? -camTilt : 0.55 + 0.3 * sin(t * 0.18) * spin
    let ux = cos(ya)
    let uy = 0.0
    let uz = sin(ya)
    let vx = -uz * sin(ta)
    let vy = cos(ta)
    let vz = ux * sin(ta)
    // plane normal n = u × v
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx

    // Radial lobes swell past R, so pull the base radius in by (most of) the
    // wobble amplitude. The silhouette then stays inside the frame however far
    // the deformation is pushed, while lobes keep getting deeper relative to
    // the mean radius.
    let wobMul = o["wobMul"] ?? 1
    let wobAmp = 0.23 * wobMul
    let baseR = faceOn ? R / (1 + 0.85 * wobAmp) : R

    let baseLanes = o["lanes"] ?? 5
    let segs = Int(o["segs"] ?? 88)
    let lanes = Swift.max(1, Int((baseLanes * (o["bandMul"] ?? 1)).rounded(.toNearestOrAwayFromZero)))
    for w in 0..<lanes {
        let laneOff = (Double(w) - Double(lanes - 1) / 2) * 0.075
        let edge = abs(Double(w) - Double(lanes - 1) / 2) / Swift.max(1, Double(lanes - 1) / 2)
        for k in 0..<segs {
            let a = (Double(k) / Double(segs)) * 2 * Double.pi
            // the undulation: two traveling waves along the band; wobMul
            // scales the deformation — 0 is a clean band
            let wob = (0.16 * sin(a * 3 - t * 1.7 + Double(w) * 0.22)
                + 0.07 * sin(a * 5 + t * 1.1)) * wobMul
            // A normal-direction wobble is cancelled by the re-normalisation
            // below: the point lands back on the sphere, so the silhouette is
            // pinned at R and the deformation can only ever pull dots inward.
            // Face-on instead modulates the in-plane RADIUS, so lobes genuinely
            // swell outward and pinch inward.
            let radial = faceOn ? 1 + wob : 1
            let off = faceOn ? laneOff : laneOff + wob
            let x = ux * cos(a) + vx * sin(a) + nx * off
            let y = uy * cos(a) + vy * sin(a) + ny * off
            let z = uz * cos(a) + vz * sin(a) + nz * off
            let l = (x * x + y * y + z * z).squareRoot()
            let rr = baseR * radial
            let (px, py, zr) = pt((x / l) * rr, (y / l) * rr, (z / l) * rr)
            let depth = (zr / R + 1) / 2
            dots.append(Dot(
                x: px, y: py, z: zr,
                r: ((o["rBase"] ?? 1.1) + (o["rDepth"] ?? 1.7) * depth) * (1 - 0.25 * edge) * rs,
                white: 0.52 - 0.44 * depth + 0.18 * edge,
                a: 0.4 + 0.6 * depth
            ))
        }
    }
    return finalizeFrame(dots, [], rMin: o["rMin"] ?? 0.3)
}
