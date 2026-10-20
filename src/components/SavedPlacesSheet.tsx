import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedPlaces, type SavedPlace } from '../store/savedPlaces';
import { colors, radius } from '../theme/colors';
import { fonts } from '../theme/font';

// Bottom-sheet list of bookmarked places. Tapping a row picks it (the caller
// adds it as a stop and shows the route); the trash icon removes it.
export function SavedPlacesSheet({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (place: SavedPlace) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const places = useSavedPlaces((s) => s.places);
  const remove = useSavedPlaces((s) => s.remove);

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
            <View style={styles.headRow}>
              <Ionicons name="bookmark" size={17} color={colors.accent} />
              <Text style={styles.title}>Saved places</Text>
              <Text style={styles.count}>{places.length}</Text>
            </View>

            {places.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bookmark-outline" size={24} color={colors.muted} />
                <Text style={styles.emptyText}>
                  No saved places yet. Search a place and tap “Save”, or save a pinned
                  location from the stop list.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {places.map((p) => (
                  <View key={p.id} style={styles.row}>
                    <Pressable onPress={() => onSelect(p)} style={styles.rowMain}>
                      <View style={styles.pin}>
                        <Ionicons name="location" size={15} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {!!p.address && (
                          <Text style={styles.note} numberOfLines={1}>
                            {p.address}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="navigate" size={17} color={colors.primaryStrong} />
                    </Pressable>
                    <Pressable
                      onPress={() => remove(p.id)}
                      hitSlop={8}
                      style={styles.trash}
                      accessibilityLabel={`Remove ${p.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
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
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily: fonts.bold },
  count: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  pin: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 15 },
  note: { color: colors.muted, fontSize: 12, marginTop: 2 },
  trash: { paddingLeft: 10, paddingVertical: 12 },
});
