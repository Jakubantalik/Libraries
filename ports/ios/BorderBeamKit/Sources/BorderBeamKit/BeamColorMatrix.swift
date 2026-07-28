import Foundation

/// Builds the 3x3 color matrix for the CSS filter chain
/// `hue-rotate(θ) brightness(b) saturate(s)` — applied left-to-right, so the
/// composed matrix is `Msaturate × (b · Mhue)`.
///
/// Matrices follow the W3C Filter Effects spec (feColorMatrix `hueRotate` /
/// `saturate`), which is what browsers use — NOT a true HSL rotation. Using the
/// same math keeps native colors identical to the web version.
enum BeamColorMatrix {
    static func hueRotate(degrees: Double) -> [Double] {
        let rad = degrees * .pi / 180
        let c = cos(rad)
        let s = sin(rad)
        return [
            0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
            0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
            0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
        ]
    }

    static func saturate(_ s: Double) -> [Double] {
        [
            0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
            0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
            0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
        ]
    }

    static func multiply(_ a: [Double], _ b: [Double]) -> [Double] {
        var out = [Double](repeating: 0, count: 9)
        for row in 0..<3 {
            for col in 0..<3 {
                var sum = 0.0
                for k in 0..<3 {
                    sum += a[row * 3 + k] * b[k * 3 + col]
                }
                out[row * 3 + col] = sum
            }
        }
        return out
    }

    /// Composed matrix for `hue-rotate(hueDegrees) brightness(brightness)
    /// saturate(saturation)` as `Float`s ready for the shader.
    static func composed(hueDegrees: Double, brightness: Double, saturation: Double) -> [Float] {
        let hue = hueRotate(degrees: hueDegrees).map { $0 * brightness }
        return multiply(saturate(saturation), hue).map { Float($0) }
    }
}
