import type { IComputeKernel, SceneObject, CollisionPair } from '@/types'

export function createMockKernel(): IComputeKernel {
  return {
    init(_objects: SceneObject[]) {},
    updatePositions(_positions: Float32Array) {},
    getCollisions(): CollisionPair[] { return [] },
    getBVHTraversalTime(): number { return 0 },
    dispose() {},
  }
}
