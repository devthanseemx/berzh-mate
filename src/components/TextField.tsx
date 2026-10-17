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
        style={[styles.input, !editable && { opacity: 0.6 }]}
      />
      {!!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 12 },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  note: { color: colors.muted, fontSize: 12 },
});