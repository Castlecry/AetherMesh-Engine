import type { IComputeKernel, SceneObject, CollisionPair } from '@/types'

export function createMockKernel(): IComputeKernel {
  let objects: SceneObject[] = []

  return {
    init(sceneObjects: SceneObject[]) {
      objects = [...sceneObjects]
    },

    updatePositions(newPositions: Float32Array) {
      // Simulate Y-flip like the real kernel would do
      for (let i = 1; i < newPositions.length; i += 3) {
        newPositions[i] = -newPositions[i]
      }
    },

    getCollisions(): CollisionPair[] {
      // Brute-force AABB overlap test (O(N²))
      const result: CollisionPair[] = []
      const robotIdx = 0
      const robot = objects[robotIdx]
      if (!robot) return result

      for (let i = 1; i < objects.length; i++) {
        const obj = objects[i]
        const [rx, ry, rz] = robot.position
        const [rhw, rhh, rhd] = robot.halfExtents
        const [ox, oy, oz] = obj.position
        const [ohw, ohh, ohd] = obj.halfExtents

        const overlapX = Math.abs(rx - ox) < (rhw + ohw)
        const overlapY = Math.abs(ry - oy) < (rhh + ohh)
        const overlapZ = Math.abs(rz - oz) < (rhd + ohd)

        if (overlapX && overlapY && overlapZ) {
          const penX = (rhw + ohw) - Math.abs(rx - ox)
          const penY = (rhh + ohh) - Math.abs(ry - oy)
          const penZ = (rhd + ohd) - Math.abs(rz - oz)
          const penetration = Math.min(penX, penY, penZ)
          result.push({
            objectA: robot.id,
            objectB: obj.id,
            penetration,
            contactPoint: [(rx + ox) / 2, (ry + oy) / 2, (rz + oz) / 2]
          })
        }
      }
      return result
    },

    getBVHTraversalTime(): number {
      return 0.05 + Math.random() * 0.02
    },

    dispose() {
      objects = []
    },
  }
}
