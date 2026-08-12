module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 3 (Expo SDK 53) ships the worklet transform in the reanimated
    // package itself. Reanimated 4 moved it to 'react-native-worklets/plugin' —
    // switch to that if this example is ever bumped to SDK 54+. Must stay last.
    plugins: ['react-native-reanimated/plugin'],
  };
};
