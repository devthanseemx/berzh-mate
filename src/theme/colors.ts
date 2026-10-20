// Berzh Mate design tokens — clean white theme, amber brand.
export const colors = {
  // Surfaces — white background, white cards, light-gray inner tiles.
  bg: '#FFFFFF',
  surface: '#FFFFFF', // cards are white
  surfaceAlt: '#F4F6F9', // subtle gray for inner tiles/chips
  input: '#FFFFFF', // text fields are white
  border: '#E5E7EB', // light-gray hairline used on cards, inputs, dividers
  text: '#0F172A', // near-black
  muted: '#64748B',

  // Brand — amber / orange
  primary: '#F59E0B', // fills: buttons, chips, badges
  primaryStrong: '#D97706', // pressed states, icons, emphasis
  primarySoft: '#FEF3C7', // tinted backgrounds
  onPrimary: '#1F1300', // text on amber fills
  accent: '#B45309', // amber text on light surfaces (AA contrast)

  danger: '#E11D48', // red
  warn: '#D97706', // orange
  success: '#059669', // green
  up: '#059669', // moved earlier in the order
  down: '#E11D48', // moved later in the order

  // Route
  routeActive: '#0284C7', // sky blue: the leg you're on
  routeActiveCasing: '#FFFFFF', // white edge so the active leg stands out on every map style
  routeUpcoming: '#DB2777', // pink: later legs (clearly different from the blue)
  routeReroute: '#7C3AED', // violet: roads changed by a reroute

  // Stops
  stop: '#0D9488',
  stopNext: '#FFFFFF',
  stopVisited: '#94A3B8',

  // Your position
  me: '#F59E0B',
  meHalo: 'rgba(245, 158, 11, 0.30)',

  candidate: '#EC4899',

  // Map labels: dark ink with a white halo reads best on light map styles.
  mapInk: '#1E293B',
  mapHalo: '#FFFFFF',
};

// THE single border-radius definition for the whole app (rounded-md everywhere).
// Cards, sheets, inputs and buttons all read from here — change it once, it changes everywhere.
// Only true pills (chips/badges) and circles use 999 / 50%.
export const radius = { md: 16, lg: 16 };

// THE card treatment: white card with a light-gray hairline border. No shadow.
// Every card in scroll content spreads this — change it once, it changes everywhere.
export const cardStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
} as const;

// Shadows are reserved for elements that float OVER the map (sheets, map controls),
// where a border alone wouldn't separate them from the map imagery.
export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  float: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;
