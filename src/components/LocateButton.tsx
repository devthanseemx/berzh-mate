import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, shadow } from '../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  onPress: () => void;
  busy?: boolean;
};

export function LocateButton({ onPress, busy }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityLabel="Center map on my location"
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      disabled={busy}
      style={[styles.button, animated]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primaryStrong} />
      ) : (
        <Ionicons name="locate" size={20} color={colors.primaryStrong} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // Same 44×44 rounded-square shape as the other map controls.
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
});
