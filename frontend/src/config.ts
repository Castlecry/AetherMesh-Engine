export const ENGINE_CONFIG = {
  ai: {
    mode: 'real' as 'real' | 'mock',
    // Backend API base URL — relative path goes through Vite proxy in dev,
    // or set VITE_BACKEND_URL env var to point directly at the backend server.
    backendUrl: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001',
    model: 'qwen3.5:9b',
    retryCount: 2,
  },
  compute: {
    mode: 'mock' as 'real' | 'mock',
    wasmPath: '/wasm/engine_core.js',
  },
}
