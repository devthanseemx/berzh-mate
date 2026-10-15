import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useMapPrefs } from '../store/mapPrefs';
import { colors } from '../theme/colors';
import { MAP_STYLES, type MapStyleKey } from '../theme/mapStyles';

export function MapStyleSwitcher() {
  const styleKey = useMapPrefs((s) => s.styleKey);
  const setStyleKey = useMapPrefs((s) => s.setStyleKey);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.row}
    >
      {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
        const active = key === styleKey;
        return (
          <Pressable
            key={key}
            onPress={() => setStyleKey(key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{MAP_STYLES[key].label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 2 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontWeight: '600', fontSize: 13 },
  labelActive: { color: colors.bg },
});