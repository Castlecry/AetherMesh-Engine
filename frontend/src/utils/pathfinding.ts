/**
 * 2D grid-based A* pathfinder + collision checks.
 * No AI dependency — pure geometric computation.
 */

import type { SceneObject } from '@/types'

// ---- Grid config ----
const GRID_RES = 0.25       // finer grid → ~60×60
const GRID_MIN = -7.5
const GRID_MAX = 7.5
const GRID_SIZE = Math.floor((GRID_MAX - GRID_MIN) / GRID_RES) + 1
const ROBOT_RADIUS = 0.35   // robot halfExtents (0.3) + 0.05 margin
const OBSTACLE_PAD = 0.35   // must match ROBOT_RADIUS: grid cell blocked where robot center can't go

// ---- Helpers ----

function worldToGrid(wx: number) { return Math.round((wx - GRID_MIN) / GRID_RES) }
function gridToWorld(g: number)  { return +(GRID_MIN + g * GRID_RES).toFixed(2) }

function getExtents(obj: SceneObject): { hx: number; hz: number } {
  if (obj.meshType === 'sphere') {
    const r = obj.halfExtents[0]
    return { hx: r, hz: r }
  }
  return { hx: obj.halfExtents[0], hz: obj.halfExtents[2] }
}

function octileDist(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx), dz = Math.abs(az - bz)
  return Math.max(dx, dz) + 0.414 * Math.min(dx, dz)
}

// ---- Occupancy grid ----

export function buildOccupancyGrid(objects: SceneObject[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false))
  for (const obj of objects) {
    if (obj.tag === 'robot' || obj.id === objects[0]?.id) continue
    const { hx: extX, hz: extZ } = getExtents(obj)
    const cx = worldToGrid(obj.position[0])
    const cz = worldToGrid(obj.position[2])
    const hx = Math.ceil((extX + OBSTACLE_PAD) / GRID_RES)
    const hz = Math.ceil((extZ + OBSTACLE_PAD) / GRID_RES)
    for (let dx = -hx; dx <= hx; dx++)
      for (let dz = -hz; dz <= hz; dz++) {
        const gx = cx + dx, gz = cz + dz
        if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) grid[gx][gz] = true
      }
  }
  return grid
}

// ---- Collision query ----

export function isPositionBlocked(x: number, z: number, objects: SceneObject[], robotId: string): boolean {
  for (const obj of objects) {
    if (obj.id === robotId) continue
    const { hx, hz } = getExtents(obj)
    if (Math.abs(x - obj.position[0]) < hx + ROBOT_RADIUS &&
        Math.abs(z - obj.position[2]) < hz + ROBOT_RADIUS) return true
  }
  return false
}

export function isDirectPathClear(
  ax: number, az: number, bx: number, bz: number,
  objects: SceneObject[], robotId: string, steps = 20
): boolean {
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (isPositionBlocked(ax + (bx - ax) * t, az + (bz - az) * t, objects, robotId)) return false
  }
  return true
}

// ---- A* pathfinding ----

export function findPath(
  objects: SceneObject[], startX: number, startZ: number,
  targetX: number, targetZ: number
): [number, number, number][] | null {
  const grid = buildOccupancyGrid(objects)
  const clamp = (v: number) => Math.max(0, Math.min(GRID_SIZE - 1, v))
  const key = (x: number, z: number) => `${x},${z}`

  const sxRaw = worldToGrid(startX), szRaw = worldToGrid(startZ)
  const txRaw = worldToGrid(targetX), tzRaw = worldToGrid(targetZ)
  let sx = clamp(sxRaw), sz = clamp(szRaw)
  const tx = clamp(txRaw), tz = clamp(tzRaw)

  // If start cell is blocked, try nearby cells
  if (grid[sx]?.[sz]) {
    let foundStart = false
    for (let r = 1; r <= 4 && !foundStart; r++)
      for (let dx = -r; dx <= r && !foundStart; dx++)
        for (let dz = -r; dz <= r && !foundStart; dz++) {
          const nx = clamp(sx + dx), nz = clamp(sz + dz)
          if (!grid[nx]?.[nz]) { sx = nx; sz = nz; foundStart = true }
        }
    if (!foundStart) return null
  }

  // Target candidates: prefer exact target, then nearby clear cells
  const targets: [number, number][] = []
  if (!grid[tx]?.[tz]) targets.push([tx, tz])
  for (let r = 1; r <= 6 && targets.length < 9; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const nx = clamp(tx + dx), nz = clamp(tz + dz)
        if (!grid[nx]?.[nz]) targets.push([nx, nz])
      }

  // A*
  interface Cell { x: number; z: number; g: number; f: number; parent: Cell | null; closed: boolean }
  const cells = new Map<string, Cell>()
  const start: Cell = { x: sx, z: sz, g: 0, f: octileDist(sx, sz, tx, tz), parent: null, closed: false }
  cells.set(key(sx, sz), start)
  const open = [start]

  const dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  let found: Cell | null = null

  while (open.length > 0 && open.length < 20000) {
    let best = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i
    const cur = open.splice(best, 1)[0]
    cur.closed = true

    for (const [tcx, tcz] of targets) {
      if (cur.x === tcx && cur.z === tcz) { found = cur; break }
    }
    if (found) break

    for (const [ddx, ddz] of dirs) {
      const nx = cur.x + ddx, nz = cur.z + ddz
      if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE || grid[nx]?.[nz]) continue
      const nk = key(nx, nz)
      const exist = cells.get(nk)
      if (exist?.closed) continue
      const ng = cur.g + (ddx && ddz ? 1.414 : 1)
      if (exist && ng >= exist.g) continue
      const nCell: Cell = { x: nx, z: nz, g: ng, f: ng + octileDist(nx, nz, tx, tz), parent: cur, closed: false }
      cells.set(nk, nCell)
      open.push(nCell)
    }
  }

  if (!found) return null

  // Reconstruct & simplify
  const raw: [number, number][] = []
  for (let n: Cell | null = found; n; n = n.parent) raw.push([n.x, n.z])
  raw.reverse()

  const waypoints: [number, number, number][] = []
  for (let i = 0; i < raw.length; i++) {
    if (i > 0 && i < raw.length - 1) {
      const [px, pz] = raw[i - 1], [cx, cz] = raw[i], [nx, nz] = raw[i + 1]
      if ((cx - px) * (nz - cz) === (cz - pz) * (nx - cx)) continue
    }
    waypoints.push([gridToWorld(raw[i][0]), 0.3, gridToWorld(raw[i][1])])
  }
  return waypoints.length > 1 ? waypoints : null
}

// ---- Radial search for best clear direction (for sliding along obstacles) ----

export function findBestClearDirection(
  fromX: number, fromZ: number,
  prefDx: number, prefDz: number,
  objects: SceneObject[], robotId: string, stepSize = 0.06
): { x: number; z: number } | null {
  // Try forward direction first, then increasingly tangential angles
  const prefLen = Math.sqrt(prefDx * prefDx + prefDz * prefDz) || 1
  const fdx = prefDx / prefLen, fdz = prefDz / prefLen

  // Angles to try: 0° (forward), then ±30°, ±45°, ±60°, ±75°, ±90°
  const angles = [0, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90]
  const degToRad = Math.PI / 180

  for (const deg of angles) {
    const rad = deg * degToRad
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const rx = fdx * cos - fdz * sin
    const rz = fdx * sin + fdz * cos

    const tx = fromX + rx * stepSize
    const tz = fromZ + rz * stepSize
    if (!isPositionBlocked(tx, tz, objects, robotId)) return { x: tx, z: tz }
  }
  return null
}
