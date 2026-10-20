import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useMapPrefs } from '../store/mapPrefs';
import { colors, radius, shadow } from '../theme/colors';
import { MAP_STYLES, type MapStyleKey } from '../theme/mapStyles';
import { OptionSheet } from './OptionSheet';

// One icon per style, so the sheet is scannable without reading every row.
const STYLE_ICON: Record<MapStyleKey, keyof typeof Ionicons.glyphMap> = {
  streets: 'map-outline',
  night: 'moon-outline',
  satellite: 'globe-outline',
  outdoors: 'leaf-outline',
  light: 'sunny-outline',
};

// Compact map-style control: a single floating icon button. Tapping it opens
// a small bottom sheet with the style list — no chip row covering the map.
export function MapStyleSwitcher() {
  const styleKey = useMapPrefs((s) => s.styleKey);
  const setStyleKey = useMapPrefs((s) => s.setStyleKey);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel="Map style"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="layers-outline" size={20} color={colors.primaryStrong} />
      </Pressable>

      <OptionSheet
        visible={open}
        title="Map style"
        value={styleKey}
        options={(Object.keys(MAP_STYLES) as MapStyleKey[]).map((k) => ({
          key: k,
          label: MAP_STYLES[k].label,
          icon: <Ionicons name={STYLE_ICON[k]} size={17} color={colors.primaryStrong} />,
        }))}
        onSelect={setStyleKey}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  buttonPressed: { backgroundColor: colors.surfaceAlt },
});
