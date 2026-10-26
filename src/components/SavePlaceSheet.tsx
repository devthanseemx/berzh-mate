import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedButton } from './AnimatedButton';
import { colors, radius } from '../theme/colors';
import { fonts } from '../theme/font';
import { HOME_PLACE_CATEGORIES } from '../store/savedPlaces';

type Props = {
  visible: boolean;
  initialName: string;
  categories?: string[];
  onSave: (name: string, category: string | null) => void;
  onClose: () => void;
};

export function SavePlaceSheet({ visible, initialName, categories = [], onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setCategory(null);
    setCustomCategory('');
  }, [visible, initialName]);

  const options = [...new Set([...HOME_PLACE_CATEGORIES, ...categories])];
  const selectedCategory = customCategory.trim() || category;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.heading}>
              <View style={styles.icon}>
                <Ionicons name="bookmark" size={19} color={colors.accent} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.title}>Save this place</Text>
                <Text style={styles.subtitle}>Choose a name and an optional category.</Text>
              </View>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>PLACE NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name this place"
                placeholderTextColor={colors.muted}
                maxLength={60}
                returnKeyType="done"
                style={styles.input}
              />

              <Text style={[styles.label, styles.categoryHeading]}>CATEGORY (OPTIONAL)</Text>
              <View style={styles.categories}>
                {options.map((item) => {
                  const selected = category === item && !customCategory.trim();
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setCategory(selected ? null : item);
                        setCustomCategory('');
                      }}
                      style={[styles.category, selected && styles.categorySelected]}
                    >
                      <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    setCategory(null);
                    setCustomCategory('');
                  }}
                  style={[styles.category, !selectedCategory && styles.categorySelected]}
                >
                  <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextSelected]}>No category</Text>
                </Pressable>
              </View>
              <TextInput
                value={customCategory}
                onChangeText={(value) => {
                  setCustomCategory(value);
                  setCategory(null);
                }}
                placeholder="Or create a category"
                placeholderTextColor={colors.muted}
                maxLength={36}
                returnKeyType="done"
                style={styles.input}
              />

              <AnimatedButton
                label="Save place"
                onPress={() => {
                  if (!name.trim()) return;
                  onSave(name.trim(), selectedCategory);
                  onClose();
                }}
                disabled={!name.trim()}
                style={styles.save}
              />
              <AnimatedButton label="Cancel" variant="ghost" onPress={onClose} style={styles.cancel} />
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheet: {
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.bold, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 1, fontFamily: fonts.semibold, fontWeight: '700', marginBottom: 7 },
  categoryHeading: { marginTop: 18 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    color: colors.text,
    fontSize: 15,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  category: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  categorySelected: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  categoryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  categoryTextSelected: { color: colors.accent },
  save: { marginTop: 18 },
  cancel: { marginTop: 9 },
});
