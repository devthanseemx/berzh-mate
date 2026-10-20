import { MotiView } from 'moti';
import type { ViewStyle } from 'react-native';
import { colors, radius } from '../theme/colors';

type Props = {
  width?: number | `${number}%`;
  height: number;
  round?: number;
  style?: ViewStyle;
};

// Pulsing placeholder block used while a screen loads.
export function Skeleton({ width = '100%', height, round = radius.md, style }: Props) {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 700, loop: true }}
      style={[{ width, height, borderRadius: round, backgroundColor: colors.surfaceAlt }, style]}
    />
  );
}
