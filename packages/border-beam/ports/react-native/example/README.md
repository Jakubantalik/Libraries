# border-beam-native example

Expo app showcasing [`border-beam-native`](../border-beam-native) — all 5 beam
types with live pickers for color variant, theme, active state, and the web
demo's pulse tuning preset.

## Run

```bash
npm install
```

```bash
npx expo run:ios
```

```bash
npx expo run:android
```

Skia and Reanimated are native modules, so **Expo Go will not work** — `expo
run:*` builds a dev client. The first run does a prebuild plus CocoaPods
install and compiles React Native from source; budget 15+ minutes.

## Why Expo SDK 53 (not the latest)

Pinned deliberately. Expo SDK 57's `expo-modules-jsi` builds an xcframework
from an SPM package declaring **Swift tools 6.2**, which ships only with Xcode
26.x — and Xcode 26 requires macOS 26.2. On a machine capped at Xcode 16.4
(Swift 6.1) the build fails with:

```
package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0
```

SDK 53 (RN 0.79) is the newest SDK targeting Xcode 16. It satisfies this
library's peer deps either way — Reanimated 3.17 meets `>=3.0.0` and Skia 2.0
meets `>=1.0.0` — so nothing in `border-beam-native` depends on the choice.
If you upgrade macOS past 26.2, later SDKs become available and this pin can
be lifted.

On macOS, point the build at Xcode without touching the system toolchain:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx expo run:ios
```

### If `pod install` fails

**`Unicode Normalization not appropriate for ASCII-8BIT`** — a CocoaPods/Ruby
encoding bug (seen with Homebrew Ruby 4.x + CocoaPods 1.17), not a problem with
this project. Force a UTF-8 locale:

```bash
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

**`tar: ... Write to restore size failed`** — the disk filled up while
extracting `React.xcframework`. Budget ~10 GB free; `npm cache clean --force`
reclaims a lot cheaply.

## How the local package is linked

`metro.config.js` consumes `../border-beam-native` **from source** rather than a
built `lib/`, via `watchFolders` plus an `extraNodeModules` alias. Two
consequences worth knowing:

- Edits to the library hot-reload here — no build step in the loop.
- The peer deps (`react`, `react-native`, `@shopify/react-native-skia`,
  `react-native-reanimated`, `react-native-worklets`) are pinned to this app's
  copies. Without that, Metro can resolve two copies of Skia or Reanimated and
  their native bindings break.

`tsconfig.json` mirrors the alias with a `paths` entry so the editor resolves
the same source.

## Note on `pulse-outside`

Its halo renders *behind* the wrapped child at `zIndex: -1`, so the child must
be opaque — the same requirement as the web version. If the card is
transparent, the glow shows through it instead of only spilling outward.

### If the app crashes with `Cannot find native module 'ExpoAsset'`

npm sometimes nests `expo-asset` under `node_modules/expo/node_modules/`
instead of hoisting it, and Expo autolinking misses it there — the native
binary then ships without the module the JS side requires at startup. Fix:

```bash
npx expo install expo-asset && cd ios && pod install && cd .. && npx expo run:ios
```
