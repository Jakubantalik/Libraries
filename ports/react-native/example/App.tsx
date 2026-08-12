// Mirrors the web demo and the SwiftUI demo: every state at both sizes, a
// theme toggle, and a speed control. Speed is a row of presets rather than a
// slider so the example stays on Expo's own dependencies.

import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThinkingOrb } from 'thinking-orbs-native';
import type { OrbState } from 'thinking-orbs-native';

const STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
];

const SPEEDS = [0.5, 1, 2];

export default function App() {
  const system = useColorScheme();
  // start from the OS, then let the toggle override it — the same three-layer
  // idea as the web build, minus the DOM ancestor layer
  const [dark, setDark] = useState(system !== 'light');
  const [speed, setSpeed] = useState(1);

  const c = dark ? darkColors : lightColors;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: c.fg }]}>Thinking Orbs</Text>
        <Pressable onPress={() => setDark((d) => !d)} hitSlop={12}>
          <Text style={[styles.action, { color: c.fg }]}>{dark ? 'Light' : 'Dark'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {STATES.map((state) => (
          <View key={state} style={[styles.pill, { backgroundColor: c.card }]}>
            <ThinkingOrb state={state} size={64} theme={dark ? 'dark' : 'light'} speed={speed} />
            <View style={styles.labels}>
              <Text style={[styles.label, { color: c.fg }]}>Agent {state}…</Text>
              <Text style={[styles.mono, { color: c.dim }]}>{state}</Text>
            </View>
            <ThinkingOrb state={state} size={20} theme={dark ? 'dark' : 'light'} speed={speed} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <Text style={[styles.mono, { color: c.dim }]}>SPEED</Text>
        {SPEEDS.map((s) => (
          <Pressable key={s} onPress={() => setSpeed(s)} hitSlop={8}>
            <Text style={[styles.mono, { color: s === speed ? c.fg : c.dim }]}>{s}×</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const darkColors = { bg: '#0a0a0a', card: '#1a1a1a', fg: '#e8e8e8', dim: '#777' };
const lightColors = { bg: '#f7f7f7', card: '#ffffff', fg: '#1a1a1a', dim: '#888' };

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 19, fontWeight: '600' },
  action: { fontSize: 13, fontVariant: ['tabular-nums'] },
  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  labels: { flex: 1 },
  label: { fontSize: 15 },
  mono: { fontSize: 11, fontFamily: 'Courier' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
