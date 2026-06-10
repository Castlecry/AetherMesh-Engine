export const ENGINE_CONFIG = {
  ai: {
    mode: 'mock' as 'real' | 'mock',
    ollamaUrl: 'http://localhost:11434',
    model: 'qwen3.5:9b',
    retryCount: 2,
  },
  compute: {
    mode: 'mock' as 'real' | 'mock',
    wasmPath: '/wasm/engine_core.js',
  },
}
