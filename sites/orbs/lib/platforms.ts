/**
 * Install and usage snippets per platform, mirroring the beam site.
 *
 * Only the web package is on npm. The native ports live in this repo under
 * packages/thinking-orbs/ports and install from source, so each carries a note
 * saying so rather than implying a registry install that would fail.
 *
 * Every snippet is taken from the ports' real APIs — the RN props come from
 * ThinkingOrbProps, the Swift initialiser from ThinkingOrb.swift — so copying
 * one compiles.
 */

export type Platform = 'react' | 'swiftui' | 'native';

export const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'react', label: 'React' },
  { value: 'swiftui', label: 'SwiftUI' },
  { value: 'native', label: 'React Native' },
];

export const INSTALL_BY_PLATFORM: Record<Platform, string> = {
  react: 'npm install thinking-orbs',
  swiftui: '.package(url: "https://github.com/Jakubantalik/Libraries.git", from: "0.3.1")',
  native: 'npm install @shopify/react-native-skia react-native-reanimated',
};

export const USAGE_BY_PLATFORM: Record<Platform, string> = {
  react: `import { ThinkingOrb } from 'thinking-orbs';

<ThinkingOrb state="listening" size={64} />`,
  swiftui: `import ThinkingOrbsKit

ThinkingOrb(state: .listening, size: .px64)

// render the 64 design at another size, still vector-crisp
ThinkingOrb(state: .working, size: .px64, displaySize: 133)`,
  native: `import { ThinkingOrb } from 'thinking-orbs-native';

<ThinkingOrb state="listening" size={64} />`,
};

/** Shown under the install block for ports that aren't on a registry yet. */
export const INSTALL_NOTE_BY_PLATFORM: Record<Platform, string | null> = {
  react: null,
  swiftui:
    'Swift Package Manager · requires iOS 15+ · Add via File › Add Package Dependencies in Xcode.',
  native:
    'In beta — not yet published. Copy packages/thinking-orbs/ports/react-native/thinking-orbs-native from the repo, then install the peer dependencies above.',
};
