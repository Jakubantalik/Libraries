// Demo app mirroring the web demo: every state at both sizes, as inline
// chat-style pills, with a theme toggle and a speed control.

import SwiftUI
import ThinkingOrbsKit

@main
struct ThinkingOrbsDemoApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    @State private var dark = true
    @State private var speed: Double = 1

    private let states = OrbState.allCases

    var body: some View {
        ZStack {
            (dark ? Color(white: 0.04) : Color(white: 0.97)).ignoresSafeArea()

            VStack(spacing: 0) {
                header

                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(states, id: \.self) { state in
                            pill(state)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }

                controls
            }
        }
        .preferredColorScheme(dark ? .dark : .light)
    }

    private var header: some View {
        HStack {
            Text("Thinking Orbs")
                .font(.system(size: 19, weight: .semibold))
            Spacer()
            Button(dark ? "Light" : "Dark") { dark.toggle() }
                .font(.system(size: 13, design: .monospaced))
        }
        .foregroundStyle(dark ? Color(white: 0.92) : Color(white: 0.1))
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func pill(_ state: OrbState) -> some View {
        HStack(spacing: 12) {
            ThinkingOrb(state: state, size: .px64, theme: dark ? .dark : .light, speed: speed)
            VStack(alignment: .leading, spacing: 2) {
                Text("Agent \(state.rawValue)…")
                    .font(.system(size: 15))
                    .foregroundStyle(dark ? Color(white: 0.88) : Color(white: 0.12))
                Text(state.rawValue)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(dark ? Color(white: 0.45) : Color(white: 0.55))
            }
            Spacer()
            // the 20pt inline size, at its own tuning
            ThinkingOrb(state: state, size: .px20, theme: dark ? .dark : .light, speed: speed)
                .padding(.trailing, 6)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(dark ? Color(white: 0.10) : Color(white: 1.0))
        )
    }

    private var controls: some View {
        HStack(spacing: 12) {
            Text("SPEED")
                .font(.system(size: 11, design: .monospaced))
            Slider(value: $speed, in: 0.25...3)
            Text(String(format: "%.2f×", speed))
                .font(.system(size: 11, design: .monospaced))
                .frame(width: 48, alignment: .trailing)
        }
        .foregroundStyle(dark ? Color(white: 0.55) : Color(white: 0.4))
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}
