import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius } from '../theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
  // Compact size for dense toolbars (plan sheet footer, candidate actions).
  small?: boolean;
};

export function AnimatedButton({ label, onPress, variant = 'primary', disabled, style, icon, small }: Props) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const dim = useSharedValue(disabled ? 0.5 : 1);

  useEffect(() => {
    dim.value = withSpring(disabled ? 0.5 : 1);
  }, [disabled, dim]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value * (1 - pressed.value * 0.15),
  }));

  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.input;
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? '#FFFFFF' : colors.text;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96);
        pressed.value = withSpring(1);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
        pressed.value = withSpring(0);
      }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        small && styles.baseSmall,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.border },
        animated,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, small && styles.labelSmall, { color: fg }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md, alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  baseSmall: { paddingVertical: 9, paddingHorizontal: 12, gap: 6 },
  label: { fontWeight: '700', fontSize: 16 },
  labelSmall: { fontSize: 13 },
});
