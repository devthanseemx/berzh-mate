import { Text } from 'react-native';

// App typography: Inter, loaded in the root layout via @expo-google-fonts/inter.
// Every Text defaults to Inter Regular; styles pick heavier families via `fonts`.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

// Default every Text in the app to Inter. Per-style fontFamily still wins,
// so heading styles can opt into the matching weight family.
const defaults = (Text as any).defaultProps ?? {};
(Text as any).defaultProps = {
  ...defaults,
  style: [defaults.style, { fontFamily: fonts.regular }].filter(Boolean),
};
