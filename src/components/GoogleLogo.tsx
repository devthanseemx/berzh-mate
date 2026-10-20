import { Image } from 'react-native';

// The four-color Google "G" mark, bundled as a PNG so it needs no native modules.
export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/google-g.png')}
      style={{ width: size, height: size }}
      accessibilityLabel="Google logo"
    />
  );
}
