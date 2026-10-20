import { MotiView } from 'moti';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from './AnimatedButton';
import { colors, radius } from '../theme/colors';

// Custom confirmation dialog — replaces native Alert.alert so the design
// matches the app. Returns true when the user confirms.
// Usage: const confirm = useConfirm();
//        if (await confirm({ title: 'Delete?', message: '...', confirmLabel: 'Delete', danger: true })) { ... }

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>.');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    setOpts(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal transparent visible={!!opts} animationType="fade" onRequestClose={() => answer(false)}>
        <View style={styles.backdrop}>
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 180 }}
            style={styles.card}
          >
            <Text style={styles.title}>{opts?.title}</Text>
            {!!opts?.message && <Text style={styles.message}>{opts.message}</Text>}
            <View style={styles.row}>
              <AnimatedButton
                label={opts?.cancelLabel ?? 'Cancel'}
                variant="ghost"
                onPress={() => answer(false)}
                small
                style={{ flex: 1 }}
              />
              <AnimatedButton
                label={opts?.confirmLabel ?? 'Confirm'}
                variant={opts?.danger ? 'danger' : 'primary'}
                onPress={() => answer(true)}
                small
                style={{ flex: 1 }}
              />
            </View>
          </MotiView>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    width: '100%',
    maxWidth: 320,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  message: { color: colors.muted, marginTop: 6, lineHeight: 18, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
