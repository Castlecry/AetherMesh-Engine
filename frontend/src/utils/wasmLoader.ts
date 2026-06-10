import type { IComputeKernel } from '@/types'
import { ENGINE_CONFIG } from '@/config'
import { createMockKernel } from './mockKernel'

let kernelInstance: IComputeKernel | null = null

export async function loadKernel(): Promise<IComputeKernel> {
  if (ENGINE_CONFIG.compute.mode === 'mock') {
    kernelInstance = createMockKernel()
    return kernelInstance
  }

  try {
    // Real Wasm loader — to be implemented in Sprint 5
    console.warn('[wasmLoader] Real mode not yet implemented, falling back to mock kernel')
    kernelInstance = createMockKernel()
    return kernelInstance
  } catch (err) {
    console.error('[wasmLoader] Failed to load Wasm kernel, falling back to mock:', err)
    kernelInstance = createMockKernel()
    return kernelInstance
  }
}

export function getKernel(): IComputeKernel | null {
  return kernelInstance
}
