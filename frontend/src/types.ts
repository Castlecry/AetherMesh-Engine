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

// ---- Seeded PRNG (mulberry32) ----
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Scene presets
export type ScenePreset = 'default' | 'warehouse' | 'scattered' | 'corridor'

const PRESET_CONFIGS: Record<ScenePreset, { count: number; seed: number; desc: string }> = {
  default:   { count: 80,  seed: 42,    desc: '默认随机场景' },
  warehouse: { count: 120, seed: 2024,  desc: '密集仓库场景' },
  scattered: { count: 30,  seed: 9999,  desc: '稀疏空旷场景' },
  corridor:  { count: 50,  seed: 7777,  desc: '走廊通道场景' },
}

const COLORS: [number, number, number][] = [
  [0.2, 0.6, 1.0], [1.0, 0.3, 0.3], [0.3, 1.0, 0.4],
  [1.0, 0.9, 0.2], [0.8, 0.3, 1.0], [0.0, 0.8, 0.8],
  [1.0, 0.6, 0.0], [0.6, 0.0, 0.6], [0.0, 0.6, 0.6],
]

const TAGS = [
  'static_obstacle', 'static_obstacle', 'static_obstacle',
  'storage_rack', 'pillar', 'barrel',
  'crate', 'pallet', 'cone',
]

function getTag(rand: () => number): string {
  return TAGS[Math.floor(rand() * TAGS.length)]
}

// Fake data with seeded random for reproducibility
export function generateFakeObjects(count: number, seed?: number): SceneObject[] {
  const rand = mulberry32(seed ?? Date.now())
  const objects: SceneObject[] = []

  for (let i = 0; i < count; i++) {
    objects.push({
      id: `obj_${i}`,
      tag: i === 0 ? 'robot' : getTag(rand),
      position: [
        (rand() - 0.5) * 16,
        rand() * 0.5 + 0.2,
        (rand() - 0.5) * 16
      ],
      halfExtents: [0.2 + rand() * 0.6, 0.2 + rand() * 0.8, 0.2 + rand() * 0.6],
      meshType: rand() > 0.3 ? 'box' : 'sphere',
      color: COLORS[i % COLORS.length],
    })
  }

  // Robot at origin, distinct
  objects[0].position = [0, 0.3, 0]
  objects[0].halfExtents = [0.3, 0.3, 0.3]
  objects[0].color = [0.0, 1.0, 0.5]
  objects[0].tag = 'robot'
  return objects
}

// Generate scene from preset
export function generatePresetScene(preset: ScenePreset): SceneObject[] {
  const cfg = PRESET_CONFIGS[preset]
  return generateFakeObjects(cfg.count, cfg.seed)
}

// ---- De-overlap: push apart overlapping objects ----
export function deoverlapObjects(objects: SceneObject[], iterations = 8): SceneObject[] {
  const objs = objects.map(o => ({ ...o, position: [...o.position] as [number, number, number] }))
  const skipIds = new Set([objs[0]?.id]) // don't move the robot

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 1; i < objs.length; i++) {
      if (skipIds.has(objs[i].id)) continue
      for (let j = i + 1; j < objs.length; j++) {
        if (skipIds.has(objs[j].id)) continue

        const a = objs[i], b = objs[j]

        // AABB overlap check
        const dx = Math.abs(a.position[0] - b.position[0])
        const dy = Math.abs(a.position[1] - b.position[1])
        const dz = Math.abs(a.position[2] - b.position[2])
        const ox = a.halfExtents[0] + b.halfExtents[0] - dx
        const oy = a.halfExtents[1] + b.halfExtents[1] - dy
        const oz = a.halfExtents[2] + b.halfExtents[2] - dz

        if (ox <= 0 || oy <= 0 || oz <= 0) continue // no overlap

        // Push apart on axis of minimum overlap
        const sign = a.position[0] > b.position[0] ? 1 : -1
        if (ox <= oy && ox <= oz) {
          a.position[0] += sign * ox * 0.55
          b.position[0] -= sign * ox * 0.55
        } else if (oy <= ox && oy <= oz) {
          const sy = a.position[1] > b.position[1] ? 1 : -1
          a.position[1] += sy * oy * 0.55
          b.position[1] -= sy * oy * 0.55
        } else {
          const sz = a.position[2] > b.position[2] ? 1 : -1
          a.position[2] += sz * oz * 0.55
          b.position[2] -= sz * oz * 0.55
        }

        // Clamp to bounds
        for (const obj of [a, b]) {
          obj.position[0] = Math.max(-7.5, Math.min(7.5, obj.position[0]))
          obj.position[1] = Math.max(0.2, Math.min(2, obj.position[1]))
          obj.position[2] = Math.max(-7.5, Math.min(7.5, obj.position[2]))
        }
      }
    }
  }
  return objs
}

// List available presets
export function getScenePresets(): { key: ScenePreset; desc: string; count: number }[] {
  return Object.entries(PRESET_CONFIGS).map(([key, cfg]) => ({
    key: key as ScenePreset,
    desc: cfg.desc,
    count: cfg.count,
  }))
}
