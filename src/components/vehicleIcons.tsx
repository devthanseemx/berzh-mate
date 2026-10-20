import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { VehicleKey } from '../services/geoapify';

// MaterialCommunityIcons names, tsc-verified against the installed glyphmap
// ('car-sport' and 'motorcycle' do NOT exist there and render blank).
export const VEHICLE_ICON: Record<string, string> = {
  car: 'car-sports',
  three_wheeler: 'moped',
  motorcycle: 'motorbike',
  bicycle: 'bicycle',
  walk: 'walk',
};

// Renders the icon for a vehicle key at the given size/color.
export function VehicleIcon({ name, size = 18, color }: { name: VehicleKey; size?: number; color: string }) {
  return (
    <MaterialCommunityIcons name={(VEHICLE_ICON[name] ?? 'car-sports') as any} size={size} color={color} />
  );
}
