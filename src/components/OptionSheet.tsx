import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/colors';
import { fonts } from '../theme/font';

// Small bottom-sheet picker — the compact way to choose an option (map style,
// vehicle type, …) without a row of text chips covering the map.
export type OptionItem<T extends string> = { key: T; label: string; note?: string; icon?: ReactNode };

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: OptionItem<T>[];
  value: T;
  onSelect: (key: T) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <MotiView
          from={{ opacity: 0, translateY: 32, scale: 0.96 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 200 }}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          {/* Tap inside the sheet must not close it. */}
          <Pressable onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            {options.map((o) => {
              const on = o.key === value;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => {
                    onSelect(o.key);
                    onClose();
                  }}
                  style={[styles.row, on && styles.rowOn]}
                >
                  {!!o.icon && <View style={styles.optIcon}>{o.icon}</View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
                    {!!o.note && <Text style={styles.note}>{o.note}</Text>}
                  </View>
                  {on && <Ionicons name="checkmark-circle" size={20} color={colors.primaryStrong} />}
                </Pressable>
              );
            })}
          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8, fontFamily: fonts.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  optIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 15 },
  labelOn: { color: colors.accent },
  note: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
