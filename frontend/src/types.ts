// === Types shared across all layers ===

export interface SceneObject {
  id: string
  tag: string
  position: [number, number, number]
  halfExtents: [number, number, number] // width, height, depth half-sizes
  meshType: 'box' | 'sphere'
  color?: [number, number, number]
}

export interface CollisionPair {
  objectA: string
  objectB: string
  penetration: number
  contactPoint: [number, number, number]
}

export interface ProfilerSnapshot {
  fps: number
  drawCalls: number
  memoryMB: number
  bvhTraversalMs: number
  gjkCallCount: number
  aiLatencyMs: number
  frameTimestamp: number
}

export interface IInstruction {
  action: 'move_to' | 'pick_up' | 'place_down' | 'follow_path'
         | 'query' | 'query_user' | 'stop' | 'unknown'
  params: Record<string, unknown>
  raw: string
}

export interface IComputeKernel {
  init(sceneObjects: SceneObject[]): void
  updatePositions(positions: Float32Array): void
  getCollisions(): CollisionPair[]
  getBVHTraversalTime(): number
  dispose(): void
}

// Fake data for pre-Wasm sprints
export function generateFakeObjects(count: number): SceneObject[] {
  const objects: SceneObject[] = []
  const colors: [number, number, number][] = [
    [0.2, 0.6, 1.0], [1.0, 0.3, 0.3], [0.3, 1.0, 0.4],
    [1.0, 0.9, 0.2], [0.8, 0.3, 1.0], [0.0, 0.8, 0.8],
  ]
  for (let i = 0; i < count; i++) {
    objects.push({
      id: `obj_${i}`,
      tag: i === 0 ? 'robot' : 'static_obstacle',
      position: [
        (Math.random() - 0.5) * 16,
        Math.random() * 0.5 + 0.2,
        (Math.random() - 0.5) * 16
      ],
      halfExtents: [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.8, 0.2 + Math.random() * 0.6],
      meshType: Math.random() > 0.3 ? 'box' : 'sphere',
      color: colors[i % colors.length],
    })
  }
  // Ensure robot is at origin and distinct
  objects[0].position = [0, 0.3, 0]
  objects[0].halfExtents = [0.3, 0.3, 0.3]
  objects[0].color = [0.0, 1.0, 0.5]
  objects[0].tag = 'robot'
  return objects
}
