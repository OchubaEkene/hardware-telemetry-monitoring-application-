import { Text, TextProps, StyleSheet } from 'react-native';

type ThemedTextProps = TextProps & {
  type?: 'title' | 'subtitle' | 'body' | 'link' | 'label';
};

export function ThemedText({ style, type = 'body', ...props }: ThemedTextProps) {
  return (
    <Text
      style={[
        styles.base,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'body' && styles.body,
        type === 'link' && styles.link,
        type === 'label' && styles.label,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: '#f8fafc',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  body: {
    fontSize: 16,
    color: '#f8fafc',
  },
  link: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
});

