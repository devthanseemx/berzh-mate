import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

// Floating back arrow, top-left — just the chevron, no box or shadow.
export function BackButton() {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityLabel="Go back"
      onPress={() => {
        Keyboard.dismiss();
        router.back();
      }}
      hitSlop={14}
      style={({ pressed }) => [styles.button, { top: insets.top + 4 }, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={27} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { position: 'absolute', left: 10, zIndex: 50, padding: 4 },
  pressed: { opacity: 0.4 },
});
