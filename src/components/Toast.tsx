import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme/colors';
import { fonts } from '../theme/font';

// Custom in-app toast. Slides up from the bottom, auto-dismisses, one at a time.
// A short headline ("Done", "Saved", "Copied"…) plus an optional detail line.
// Usage: const toast = useToast(); toast.success('Saved', 'Rate saved.'); toast.error('Oops', '...');

type ToastKind = 'success' | 'error' | 'info';

type ToastMsg = { kind: ToastKind; title: string; message?: string; id: number };

const TONE: Record<ToastKind, { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success, background: '#ECFDF5' },
  error: { icon: 'alert-circle', color: colors.danger, background: '#FFF1F2' },
  info: { icon: 'information-circle', color: colors.primaryStrong, background: '#FFFBEB' },
};

type ToastApi = {
  show: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((kind: ToastKind, title: string, message?: string) => {
    seq.current += 1;
    setMsg({ kind, title, message, id: seq.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title: string, message?: string) => show('success', title, message),
      error: (title: string, message?: string) => show('error', title, message),
      info: (title: string, message?: string) => show('info', title, message),
    }),
    [show]
  );

  const tone = msg ? TONE[msg.kind] : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {!!msg && tone && (
        <MotiView
          key={msg.id}
          from={{ opacity: 0, translateY: 24, scale: 0.98 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          exit={{ opacity: 0, translateY: 16 }}
          transition={{ type: 'timing', duration: 220 }}
          style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 6 }]}
        >
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => setMsg(null)}
            accessibilityRole="button"
            accessibilityLabel={[msg.title, msg.message].filter(Boolean).join('. ')}
          >
            <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
              <Ionicons name={tone.icon} size={21} color={tone.color} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {msg.title}
              </Text>
              {!!msg.message && (
                <Text style={styles.message} numberOfLines={2}>
                  {msg.message}
                </Text>
              )}
            </View>
          </Pressable>
        </MotiView>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, maxWidth: 440, alignSelf: 'center', zIndex: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...shadow.float,
  },
  cardPressed: { opacity: 0.92 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, flexShrink: 1 },
  title: { color: colors.text, fontWeight: '800', fontSize: 13, fontFamily: fonts.bold },
  message: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
