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
};

export function AnimatedButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'primary' ? colors.bg : variant === 'danger' ? colors.text : colors.primary;

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.primary, opacity: disabled ? 0.5 : 1 },
        animated,
        style,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: radius.md, alignItems: 'center' },
  label: { fontWeight: '700', fontSize: 16 },
});