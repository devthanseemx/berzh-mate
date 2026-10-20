import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../theme/colors';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'decimal-pad';
  editable?: boolean;
  placeholder?: string;
  note?: string;
};

export function TextField({ label, value, onChangeText, secure, keyboard = 'default', editable = true, placeholder, note }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize="none"
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused, !editable && { opacity: 0.6 }]}
      />
      {!!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 12 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  // Focused: amber ring, still white.
  inputFocused: { borderColor: colors.primary },
  note: { color: colors.muted, fontSize: 12 },
});
