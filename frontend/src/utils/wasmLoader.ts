import type { IComputeKernel, SceneObject, CollisionPair } from '@/types'
import { ENGINE_CONFIG } from '@/config'
import { createMockKernel } from './mockKernel'

let kernelInstance: IComputeKernel | null = null

interface WasmEngineCore {
  init(objectCount: number): void
  processVertices(dataPtr: number, count: number): number
  getCollisionCount(): number
  getCollisionData(): number
  getTraversalTime(): number
  dispose(): void
}

export async function loadKernel(): Promise<IComputeKernel> {
  if (ENGINE_CONFIG.compute.mode === 'mock') {
    kernelInstance = createMockKernel()
    console.log('[wasmLoader] Using mock kernel')
    return kernelInstance
  }

  try {
    // Dynamically load the Emscripten-generated module
    const Module: any = await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = ENGINE_CONFIG.compute.wasmPath
      script.onload = () => {
        if ((window as any).createAetherModule) {
          (window as any).createAetherModule().then(resolve).catch(reject)
        } else {
          reject(new Error('createAetherModule not found on window'))
        }
      }
      script.onerror = () => reject(new Error('Failed to load Wasm glue script'))
      document.head.appendChild(script)
    })

    const core: WasmEngineCore = new Module.EngineCore()
    let objCount = 0
    let heapFloat32: Float32Array

    kernelInstance = {
      init(sceneObjects: SceneObject[]) {
        objCount = sceneObjects.length
        core.init(objCount)
      },

      updatePositions(positions: Float32Array) {
        // Zero-copy: allocate linear memory and copy Float32Array in
        const byteSize = positions.length * 4
        const ptr = Module._malloc(byteSize)
        Module.HEAPU8.set(new Uint8Array(positions.buffer), ptr)

        const resultPtr = core.processVertices(ptr, positions.length / 3)

        // Read back processed data via HEAPF32 subarray view
        heapFloat32 = Module.HEAPF32.subarray(
          resultPtr >> 2,
          (resultPtr >> 2) + positions.length
        )

        Module._free(ptr)
      },

      getCollisions(): CollisionPair[] {
        const count = core.getCollisionCount()
        if (count === 0) return []

        const dataPtr = core.getCollisionData()
        if (!dataPtr) return []

        const result: CollisionPair[] = []
        const floats = Module.HEAPF32.subarray(dataPtr >> 2, (dataPtr >> 2) + count * 8)
        for (let i = 0; i < count; i++) {
          const off = i * 8
          result.push({
            objectA: `obj_${floats[off]}`,
            objectB: `obj_${floats[off + 1]}`,
            penetration: floats[off + 2],
            contactPoint: [floats[off + 5], floats[off + 6], floats[off + 7]],
          })
        }
        return result
      },

      getBVHTraversalTime(): number {
        return core.getTraversalTime()
      },

      dispose() {
        core.dispose()
      },
    }

    console.log('[wasmLoader] Wasm kernel loaded successfully')
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
