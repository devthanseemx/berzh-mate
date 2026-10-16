import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPlaces } from '../services/geoapify';
import type { PlaceResult } from '../services/mapbox';
import { colors, radius } from '../theme/colors';
import type { LngLat } from '../types';

type Props = {
  near: LngLat | null;
  onSelect: (place: PlaceResult) => void;
};

export function SearchBar({ near, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setStatus(null);
      setBusy(false);
      return;
    }
    if (q.length < 3) {
      setResults([]);
      setStatus('Type at least 3 letters.');
      setBusy(false);
      return;
    }

    let active = true;
    setBusy(true);
    // Waits for a pause in typing, which keeps credit use low.
    const timer = setTimeout(async () => {
      try {
        const found = await searchPlaces(q, near);
        if (!active) return;
        setResults(found);
        setStatus(found.length ? null : `No places match "${q}".`);
      } catch (e: any) {
        if (!active) return;
        setResults([]);
        setStatus(`Search error: ${e.message}`);
      } finally {
        if (active) setBusy(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, near]);

  const choose = (p: PlaceResult) => {
    onSelect(p);
    setQuery('');
    setResults([]);
    setStatus(null);
  };

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search places"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.input}
      />
      {busy && <Text style={styles.hint}>Searching…</Text>}
      {!busy && status && <Text style={styles.hint}>{status}</Text>}

      {results.length > 0 && (
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 220 }}
          style={styles.list}
        >
          {results.map((p) => (
            <Pressable key={p.id} onPress={() => choose(p)} style={styles.row}>
              <Text style={styles.name}>{p.name}</Text>
              {!!p.address && (
                <Text style={styles.addr} numberOfLines={1}>
                  {p.address}
                </Text>
              )}
            </Pressable>
          ))}
          <Text style={styles.credit}>Search by Geoapify · Map data © OpenStreetMap</Text>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  hint: { color: colors.muted, marginTop: 6, marginLeft: 4 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxHeight: 340,
  },
  row: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontWeight: '600' },
  addr: { color: colors.muted, fontSize: 12, marginTop: 2 },
  credit: { color: colors.muted, fontSize: 11, padding: 10, textAlign: 'center' },
});