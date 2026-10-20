import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../theme/colors';
import { fonts } from '../theme/font';

// Custom in-app toast. Slides in from the top-right, auto-dismisses, one at a time.
// A short headline ("Done", "Saved", "Copied"…) plus an optional detail line.
// Usage: const toast = useToast(); toast.success('Saved', 'Rate saved.'); toast.error('Oops', '...');

type ToastKind = 'success' | 'error' | 'info';

type ToastMsg = { kind: ToastKind; title: string; message?: string; id: number };

const TONE: Record<ToastKind, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: 'checkmark-circle', color: colors.success },
  error: { icon: 'alert-circle', color: colors.danger },
  info: { icon: 'information-circle', color: colors.primaryStrong },
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
          from={{ opacity: 0, translateX: 40 }}
          animate={{ opacity: 1, translateX: 0 }}
          exit={{ opacity: 0, translateX: 40 }}
          transition={{ type: 'timing', duration: 220 }}
          style={[styles.wrap, { top: insets.top + 8 }]}
        >
          <Pressable style={styles.card} onPress={() => setMsg(null)}>
            <Ionicons name={tone.icon} size={20} color={tone.color} />
            {/* flexShrink (not flex:1): the card is auto-width, and flex:1
                collapses the measured text width to zero on Android. */}
            <View style={{ flexShrink: 1 }}>
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
  // Top-right, compact — never covers the map or the screen centre.
  wrap: { position: 'absolute', right: 12, maxWidth: 320, zIndex: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 13,
    ...shadow.soft,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 13, fontFamily: fonts.bold },
  message: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
