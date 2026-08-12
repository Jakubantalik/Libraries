# thinking-orbs-native example

Expo app exercising the React Native port: all nine states at both sizes,
theme toggle, speed presets.

```bash
npm install
npm run bundle:check   # Metro bundle only — no native build, no device
npm run ios            # native build + simulator (see caveat below)
npm run android
```

`metro.config.js` resolves `thinking-orbs-native` from `../thinking-orbs-native/src`
rather than a build output, so edits to the package live-reload.
`tsconfig.json` mirrors that with a `paths` entry — Metro and TypeScript each
need telling separately.

Peer dependencies (`react`, `react-native`, `@shopify/react-native-skia`,
`react-native-reanimated`) and `thinking-orbs` are pinned to this app's single
copy in `extraNodeModules`. Two copies of Skia or Reanimated break their
native bindings; two copies of `thinking-orbs` would still animate but drift
apart on a version bump, and that failure looks like a rendering glitch
rather than a resolution problem.

## Verified so far

`npm run bundle:check` bundles **1475 modules with no errors** against Expo
SDK 53 / RN 0.79.6 / Skia 2.0.0-next.4 / Reanimated 3.17.5. That covers
everything short of execution: the package's TypeScript compiles, the Babel
worklet plugin is happy, and `thinking-orbs/engine`'s subpath export resolves
under Metro — which is the piece most likely to break, since Metro's
`exports` handling is newer than Node's.

**Not yet run on a device or simulator.** Per PORT_PLAN.md, this machine's
macOS 15.3 caps Xcode at 16.4, which caps Expo at SDK 53; border-beam hit a
TurboModule registration failure there that was traced to the toolchain
rather than the library. Runtime verification belongs in CI on a
current-Xcode runner, or on a machine at macOS 26+.
