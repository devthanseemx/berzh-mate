import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../theme/colors';

export function MapControlGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide map controls' : 'Show map controls'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Ionicons
          name={expanded ? 'close' : 'options-outline'}
          size={20}
          color={colors.primaryStrong}
        />
      </Pressable>
      {expanded && (
        <MotiView
          from={{ opacity: 0, translateY: -6, scale: 0.96 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 160 }}
          style={styles.controls}
        >
          {children}
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 5,
  },
  toggle: {
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
  pressed: { backgroundColor: colors.surfaceAlt },
  controls: {
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
});
