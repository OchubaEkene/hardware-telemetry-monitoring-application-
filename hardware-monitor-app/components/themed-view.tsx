import { View, ViewProps, StyleSheet } from 'react-native';

export function ThemedView({ style, ...props }: ViewProps) {
  return (
    <View
      style={[styles.base, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#0f172a',
  },
});

