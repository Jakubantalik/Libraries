import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BorderBeam,
  WEB_DEMO_PULSE_PRESET,
  type BorderBeamColorVariant,
  type BorderBeamSize,
  type BorderBeamTheme,
} from 'border-beam-native';

const SIZES: BorderBeamSize[] = ['sm', 'md', 'line', 'pulse-outside', 'pulse-inner'];
const VARIANTS: BorderBeamColorVariant[] = ['colorful', 'mono', 'ocean', 'sunset'];
const THEMES: BorderBeamTheme[] = ['dark', 'light', 'auto'];

export default function App() {
  const [variant, setVariant] = useState<BorderBeamColorVariant>('colorful');
  const [theme, setTheme] = useState<BorderBeamTheme>('dark');
  const [active, setActive] = useState(true);
  const [tuned, setTuned] = useState(false);

  const isDark = theme !== 'light';
  const c = colors(isDark);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: c.primary }]}>Border beam</Text>
        <Text style={[styles.subtitle, { color: c.secondary }]}>
          Animated border beam component
        </Text>

        <Segmented options={VARIANTS} value={variant} onChange={setVariant} isDark={isDark} />
        <Segmented options={THEMES} value={theme} onChange={setTheme} isDark={isDark} />

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.secondary }]}>Active</Text>
          <Switch value={active} onValueChange={setActive} />
          <Text style={[styles.switchLabel, { color: c.secondary }]}>Web demo tuning</Text>
          <Switch value={tuned} onValueChange={setTuned} />
        </View>

        {SIZES.map(size => (
          <View
            key={size}
            style={[styles.sample, size === 'pulse-outside' && styles.sampleExtraRoom]}
          >
            <Text style={[styles.sampleLabel, { color: c.secondary }]}>{size}</Text>
            <BorderBeam
              size={size}
              colorVariant={variant}
              theme={theme}
              active={active}
              borderRadius={20}
              tuning={tuned ? WEB_DEMO_PULSE_PRESET : undefined}
              style={size === 'sm' ? styles.beamSm : undefined}
            >
              {/* pulse-outside renders its halo behind the child, so the card
                  must stay opaque — same requirement as the web version. */}
              <View
                style={[
                  styles.card,
                  size === 'sm' && styles.cardSm,
                  { backgroundColor: c.card, borderColor: c.border },
                ]}
              >
                <Text style={[styles.cardText, { color: c.muted }]}>
                  {size === 'sm' ? 'Button' : 'Build anything…'}
                </Text>
              </View>
            </BorderBeam>
          </View>
        ))}

        <Text style={[styles.footer, { color: c.secondary }]}>
          border-beam-native · Skia + Reanimated
        </Text>
      </ScrollView>
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  isDark,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  isDark: boolean;
}) {
  const c = colors(isDark);
  return (
    <View style={[styles.segmented, { backgroundColor: c.segmentBg }]}>
      {options.map(opt => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[styles.segment, value === opt && { backgroundColor: c.segmentActive }]}
        >
          <Text style={[styles.segmentText, { color: value === opt ? c.primary : c.secondary }]}>
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function colors(isDark: boolean) {
  return isDark
    ? {
        bg: '#070707',
        card: '#181818',
        border: '#383838',
        primary: '#ffffff',
        secondary: '#9e9e9e',
        muted: '#808080',
        segmentBg: '#1c1c1c',
        segmentActive: '#3a3a3a',
      }
    : {
        bg: '#ffffff',
        card: '#f7f7f7',
        border: '#dedede',
        primary: '#1a1a1a',
        secondary: '#616161',
        muted: '#8c8c8c',
        segmentBg: '#efefef',
        segmentActive: '#d8d8d8',
      };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: '600', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 4, marginBottom: 22 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '500' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 18 },
  switchLabel: { fontSize: 12 },
  sample: { marginBottom: 30 },
  // pulse-outside's glow spills outside its bounds; keep neighbours clear of it.
  sampleExtraRoom: { marginVertical: 22 },
  sampleLabel: { fontSize: 12, fontFamily: 'Menlo', marginBottom: 10 },
  beamSm: { alignSelf: 'flex-start' },
  card: {
    height: 118,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 16,
    paddingLeft: 20,
  },
  cardSm: {
    height: 44,
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingLeft: 0,
  },
  cardText: { fontSize: 15 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 10 },
});
