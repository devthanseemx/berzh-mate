import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

const STRIPS = 24;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

// Samples a multi-stop gradient at 0..1.
function sampleColor(stops: string[], t: number): string {
  const n = stops.length - 1;
  const seg = Math.min(n - 1, Math.max(0, Math.floor(t * n)));
  return lerpColor(stops[seg], stops[seg + 1], t * n - seg);
}

// Full-screen vertical gradient drawn with plain Views — no native module,
// so it works in every build without recompiling.
export function GradientBackdrop({ colors: stops }: { colors: string[] }) {
  const [height, setHeight] = useState(0);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      {height > 0 &&
        Array.from({ length: STRIPS }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (i * height) / STRIPS,
              height: height / STRIPS + 1,
              backgroundColor: sampleColor(stops, i / (STRIPS - 1)),
            }}
          />
        ))}
    </View>
  );
}
