// pre.js — runs before the Wasm module init
// Ensures the module supports SharedArrayBuffer in cross-origin isolated contexts
if (typeof self !== 'undefined') {
  // Stub for future zero-copy support
}
