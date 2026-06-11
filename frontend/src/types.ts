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
  default:   { count: 25,  seed: 42,    desc: '开放测试场景 — 物体少、路径多' },
  warehouse: { count: 90,  seed: 2024,  desc: '密集仓库场景' },
  scattered: { count: 15,  seed: 9999,  desc: '稀疏空旷场景' },
  corridor:  { count: 35,  seed: 7777,  desc: '走廊通道场景' },
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
export function deoverlapObjects(objects: SceneObject[], iterations = 20): SceneObject[] {
  const objs = objects.map(o => ({ ...o, position: [...o.position] as [number, number, number] }))
  const robot = objs[0]

  // Phase 1: standard de-overlap between all pairs
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 1; i < objs.length; i++) {
      for (let j = 0; j < objs.length; j++) {
        if (i === j) continue
        const a = objs[i], b = objs[j]

        const dx = Math.abs(a.position[0] - b.position[0])
        const dy = Math.abs(a.position[1] - b.position[1])
        const dz = Math.abs(a.position[2] - b.position[2])
        const ox = a.halfExtents[0] + b.halfExtents[0] - dx
        const oy = a.halfExtents[1] + b.halfExtents[1] - dy
        const oz = a.halfExtents[2] + b.halfExtents[2] - dz

        if (ox <= 0 || oy <= 0 || oz <= 0) continue

        const signX = a.position[0] > b.position[0] ? 1 : -1
        const signY = a.position[1] > b.position[1] ? 1 : -1
        const signZ = a.position[2] > b.position[2] ? 1 : -1
        // If b is robot, push a away with full force and don't move robot
        const factor = (b.id === robot?.id) ? 1.2 : 0.55

        if (ox <= oy && ox <= oz) {
          a.position[0] += signX * ox * factor
          if (b.id !== robot?.id) b.position[0] -= signX * ox * factor
        } else if (oy <= ox && oy <= oz) {
          a.position[1] += signY * oy * factor
          if (b.id !== robot?.id) b.position[1] -= signY * oy * factor
        } else {
          a.position[2] += signZ * oz * factor
          if (b.id !== robot?.id) b.position[2] -= signZ * oz * factor
        }

        for (const obj of [a, b]) {
          if (obj.id === robot?.id) continue
          obj.position[0] = Math.max(-7.5, Math.min(7.5, obj.position[0]))
          obj.position[1] = Math.max(0.2, Math.min(2, obj.position[1]))
          obj.position[2] = Math.max(-7.5, Math.min(7.5, obj.position[2]))
        }
        moved = true
      }
    }
    if (!moved) break // converged early
  }

  // Phase 2: guarantee robot clear zone (radius 2.0)
  if (robot) {
    const CLEAR_RADIUS = 2.0
    for (const obj of objs) {
      if (obj.id === robot.id) continue
      const dx = obj.position[0] - robot.position[0]
      const dz = obj.position[2] - robot.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < CLEAR_RADIUS + obj.halfExtents[0] + robot.halfExtents[0]) {
        const pushDist = CLEAR_RADIUS + obj.halfExtents[0] + robot.halfExtents[0] - dist + 0.3
        const nx = dist > 0.001 ? dx / dist : 1
        const nz = dist > 0.001 ? dz / dist : 0
        obj.position[0] = Math.max(-7.5, Math.min(7.5, obj.position[0] + nx * pushDist))
        obj.position[2] = Math.max(-7.5, Math.min(7.5, obj.position[2] + nz * pushDist))
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
