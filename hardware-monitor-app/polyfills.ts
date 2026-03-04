// Polyfills for React Native/Expo compatibility
// This file ensures certain APIs are available across all platforms

// TextEncoder/TextDecoder polyfills (if needed)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('@stardazed/streams-text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Structured clone polyfill (if needed)
if (typeof global.structuredClone === 'undefined') {
  const structuredClone = require('@ungap/structured-clone');
  global.structuredClone = structuredClone;
}

// Export empty to satisfy import
export {};

