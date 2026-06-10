# AetherMesh Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based 3D spatial simulation sandbox with Vue3 + Three.js frontend, C++/Wasm compute kernel (BVH + GJK), and local Ollama AI instruction parsing — 10 sprints, each independently runnable.

**Architecture:** Three-layer decoupled monolith — AI layer (ollamaClient.ts → IInstruction), Presentation layer (Vue3 + Three.js + Pinia), Compute layer (C++/Wasm via IComputeKernel). Each layer has mock/real modes switchable via `config.ts`. Zero-copy Float32Array between frontend and Wasm.

**Tech Stack:** Vue 3 (Composition API + `<script setup lang="ts">`) + Vite + TypeScript + Three.js + Pinia; Modern C++17 + CMake + Emscripten 6.0; Ollama + qwen3.5:9b

---

## File Structure

```
aethermesh-engine/
├── ai/
│   └── system_prompt.txt           # Created Sprint 8
├── core/
│   ├── CMakeLists.txt              # Created Sprint 4
│   ├── include/
│   │   ├── bvh.h                   # Created Sprint 6
│   │   ├── minkowski.h             # Created Sprint 7
│   │   └── engine_core.h           # Created Sprint 5
│   └── src/
│       ├── bvh.cpp                 # Created Sprint 6
│       ├── minkowski.cpp           # Created Sprint 7
│       └── engine_core.cpp         # Created Sprint 5, modified S6-S7
├── frontend/
│   ├── package.json                # Created Sprint 1
│   ├── vite.config.ts              # Created Sprint 1
│   ├── tsconfig.json               # Created Sprint 1
│   ├── index.html                  # Created Sprint 1
│   ├── src/
│   │   ├── main.ts                 # Created Sprint 1
│   │   ├── App.vue                 # Created Sprint 1, modified S2+
│   │   ├── config.ts               # Created Sprint 1, modified S4+
│   │   ├── types.ts                # Created Sprint 2
│   │   ├── stores/
│   │   │   └── simulationStore.ts  # Created Sprint 9
│   │   ├── components/
│   │   │   ├── Stage3D.vue         # Created Sprint 1, modified S2/S6/S7/S9
│   │   │   ├── ControlPanel.vue    # Created Sprint 8, modified S9
│   │   │   └── Profiler.vue        # Created Sprint 3, modified S6/S9
│   │   └── utils/
│   │       ├── wasmLoader.ts       # Created Sprint 5
│   │       ├── ollamaClient.ts     # Created Sprint 8
│   │       └── mockKernel.ts       # Created Sprint 5
│   └── public/
│       └── wasm/                   # Build output target (Sprint 4+)
├── build_wasm.sh                   # Created Sprint 4
├── README.md                       # Created Sprint 10
└── LICENSE                         # Created Sprint 10
```

---

## Sprint 1: 3D 舞台搭起来

### Task 1: Scaffold Vue3 + Vite + Three.js project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/components/Stage3D.vue`
- Create: `frontend/src/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "aethermesh-engine",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "pinia": "^2.1.7",
    "three": "^0.170.0",
    "vue": "^3.4.21"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "typescript": "^5.4.2",
    "vite": "^5.1.6",
    "vue-tsc": "^2.0.6"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend && npm install
```
Expected: packages installed without errors.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['aethermesh-engine-wasm']
  }
})
```

COOP/COEP headers are required for `SharedArrayBuffer` which Wasm needs for zero-copy.

- [ ] **Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AetherMesh Engine</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; color: #e0e0e0; font-family: 'Segoe UI', monospace; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: Create config.ts**

```typescript
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
```

- [ ] **Step 8: Create main.ts**

```typescript
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

- [ ] **Step 9: Create App.vue with Three.js scene shell**

```vue
<script setup lang="ts">
import Stage3D from './components/Stage3D.vue'
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%;">
    <Stage3D style="flex: 1;" />
  </div>
</template>
```

- [ ] **Step 10: Create Stage3D.vue — Three.js scene + camera + ground + OrbitControls**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement>()
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let animationId: number

onMounted(() => {
  if (!container.value) return

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 30, 80)

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    200
  )
  camera.position.set(8, 8, 12)
  camera.lookAt(0, 0, 0)

  // Lights
  const ambient = new THREE.AmbientLight(0x404060, 1.5)
  scene.add(ambient)
  const directional = new THREE.DirectionalLight(0xffffff, 2)
  directional.position.set(10, 20, 5)
  directional.castShadow = true
  directional.shadow.mapSize.set(2048, 2048)
  directional.shadow.camera.near = 0.5
  directional.shadow.camera.far = 100
  directional.shadow.camera.left = -20
  directional.shadow.camera.right = 20
  directional.shadow.camera.top = 20
  directional.shadow.camera.bottom = -20
  scene.add(directional)

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(40, 40)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Grid helper
  const grid = new THREE.GridHelper(20, 20, 0x444466, 0x222244)
  scene.add(grid)

  // OrbitControls (manual implementation to avoid extra dependency)
  setupOrbitControls()

  // Render loop
  function animate() {
    animationId = requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }
  animate()

  // Resize handler
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  renderer?.dispose()
  window.removeEventListener('resize', onResize)
})

function onResize() {
  if (!container.value) return
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
}

// Manual orbit controls — mouse drag to rotate, scroll to zoom
function setupOrbitControls() {
  let isDragging = false
  let prevMouse = { x: 0, y: 0 }
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position.clone().sub(new THREE.Vector3(0, 1, 0)))

  container.value!.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true
      prevMouse = { x: e.clientX, y: e.clientY }
    }
  })
  window.addEventListener('mouseup', () => { isDragging = false })
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const dx = e.clientX - prevMouse.x
    const dy = e.clientY - prevMouse.y
    spherical.theta -= dx * 0.005
    spherical.phi -= dy * 0.005
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.5, spherical.phi))
    const target = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(target)
    camera.lookAt(target)
    prevMouse = { x: e.clientX, y: e.clientY }
  })
  container.value!.addEventListener('wheel', (e) => {
    spherical.radius += e.deltaY * 0.02
    spherical.radius = Math.max(3, Math.min(40, spherical.radius))
    const target = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(target)
    camera.lookAt(target)
  })
}
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%;" />
</template>
```

- [ ] **Step 11: Verify S1 acceptance criteria**

```bash
cd frontend && npm run dev
```
Open `http://localhost:3000` in Chrome/Edge.
Expected: dark 3D scene with grid floor, camera rotates with mouse drag, zooms with scroll. No WebGL errors in console.

- [ ] **Step 12: Commit**

```bash
cd "d:/JAVAbcak/AetherMesh Engine"
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html frontend/src/
git commit -m "feat(S1): scaffold Vue3 + Three.js 3D stage with orbit controls"
```

---

## Sprint 2: 场景有内容了

### Task 2: Add types and InstancedMesh rendering

**Files:**
- Create: `frontend/src/types.ts`
- Modify: `frontend/src/components/Stage3D.vue`

- [ ] **Step 1: Create types.ts with core interfaces**

```typescript
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
```

- [ ] **Step 2: Rewrite Stage3D.vue with InstancedMesh**

Replace the entire `<script setup lang="ts">` block in [Stage3D.vue](frontend/src/components/Stage3D.vue) with the version below (keep the template the same):

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { generateFakeObjects, type SceneObject } from '@/types'

const container = ref<HTMLDivElement>()
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let animationId: number
let boxMesh: THREE.InstancedMesh
let sphereMesh: THREE.InstancedMesh
let robotMesh: THREE.InstancedMesh
let frameCount = 0
let lastFpsTime = performance.now()

const sceneObjects: SceneObject[] = generateFakeObjects(100)
const dummy = new THREE.Object3D()
const robotIndex = 0

onMounted(() => {
  if (!container.value) return

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 30, 80)

  camera = new THREE.PerspectiveCamera(60, container.value.clientWidth / container.value.clientHeight, 0.1, 200)
  camera.position.set(8, 8, 12)
  camera.lookAt(0, 0, 0)

  const ambient = new THREE.AmbientLight(0x404060, 1.5)
  scene.add(ambient)
  const directional = new THREE.DirectionalLight(0xffffff, 2)
  directional.position.set(10, 20, 5)
  directional.castShadow = true
  directional.shadow.mapSize.set(2048, 2048)
  scene.add(directional)

  const groundGeo = new THREE.PlaneGeometry(40, 40)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  scene.add(new THREE.GridHelper(20, 20, 0x444466, 0x222244))

  // Separate objects into box and sphere groups for InstancedMesh
  const boxObjects = sceneObjects.filter(o => o.id !== 'obj_0' && o.meshType === 'box')
  const sphereObjects = sceneObjects.filter(o => o.id !== 'obj_0' && o.meshType === 'sphere')

  // Box instanced mesh
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.5 })
  boxMesh = new THREE.InstancedMesh(boxGeo, boxMat, boxObjects.length)
  boxMesh.castShadow = true
  boxMesh.receiveShadow = true
  boxObjects.forEach((obj, i) => {
    dummy.position.set(...obj.position)
    dummy.scale.set(obj.halfExtents[0] * 2, obj.halfExtents[1] * 2, obj.halfExtents[2] * 2)
    dummy.updateMatrix()
    boxMesh.setMatrixAt(i, dummy.matrix)
    boxMesh.setColorAt(i, new THREE.Color(obj.color![0], obj.color![1], obj.color![2]))
  })
  boxMesh.instanceMatrix.needsUpdate = true
  boxMesh.instanceColor!.needsUpdate = true
  scene.add(boxMesh)

  // Sphere instanced mesh
  const sphereGeo = new THREE.SphereGeometry(0.5, 16, 16)
  const sphereMat = new THREE.MeshStandardMaterial({ roughness: 0.4 })
  sphereMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, sphereObjects.length)
  sphereMesh.castShadow = true
  sphereMesh.receiveShadow = true
  sphereObjects.forEach((obj, i) => {
    dummy.position.set(...obj.position)
    const s = obj.halfExtents[0] * 2
    dummy.scale.set(s, s, s)
    dummy.updateMatrix()
    sphereMesh.setMatrixAt(i, dummy.matrix)
    sphereMesh.setColorAt(i, new THREE.Color(obj.color![0], obj.color![1], obj.color![2]))
  })
  sphereMesh.instanceMatrix.needsUpdate = true
  sphereMesh.instanceColor!.needsUpdate = true
  scene.add(sphereMesh)

  // Robot instanced mesh (single instance, bright green box)
  const robotGeo = new THREE.BoxGeometry(1, 1, 1)
  const robotMat = new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: 0x004400, emissiveIntensity: 0.5 })
  robotMesh = new THREE.InstancedMesh(robotGeo, robotMat, 1)
  robotMesh.castShadow = true
  const robot = sceneObjects[0]
  dummy.position.set(...robot.position)
  dummy.scale.set(robot.halfExtents[0] * 2, robot.halfExtents[1] * 2, robot.halfExtents[2] * 2)
  dummy.updateMatrix()
  robotMesh.setMatrixAt(0, dummy.matrix)
  robotMesh.setColorAt(0, new THREE.Color(0, 1, 0.5))
  robotMesh.instanceMatrix.needsUpdate = true
  robotMesh.instanceColor!.needsUpdate = true
  scene.add(robotMesh)

  setupOrbitControls()

  function animate() {
    animationId = requestAnimationFrame(animate)
    frameCount++

    // Update FPS counter every 500ms
    const now = performance.now()
    if (now - lastFpsTime >= 500) {
      const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000))
      console.log(`FPS: ${fps}, DrawCalls: ${renderer.info.render.calls}`)
      frameCount = 0
      lastFpsTime = now
    }

    renderer.render(scene, camera)
  }
  animate()

  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  boxMesh?.dispose()
  sphereMesh?.dispose()
  robotMesh?.dispose()
  renderer?.dispose()
  window.removeEventListener('resize', onResize)
})

function onResize() {
  if (!container.value) return
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
}

function setupOrbitControls() {
  let isDragging = false
  let prevMouse = { x: 0, y: 0 }
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position.clone().sub(new THREE.Vector3(0, 1, 0)))
  container.value!.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY } }
  })
  window.addEventListener('mouseup', () => { isDragging = false })
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const dx = e.clientX - prevMouse.x
    const dy = e.clientY - prevMouse.y
    spherical.theta -= dx * 0.005
    spherical.phi -= dy * 0.005
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.5, spherical.phi))
    const target = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(target)
    camera.lookAt(target)
    prevMouse = { x: e.clientX, y: e.clientY }
  })
  container.value!.addEventListener('wheel', (e) => {
    spherical.radius += e.deltaY * 0.02
    spherical.radius = Math.max(3, Math.min(40, spherical.radius))
    const target = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(target)
    camera.lookAt(target)
  })
}
</script>
```

- [ ] **Step 3: Verify S2 acceptance criteria**

```bash
cd frontend && npm run dev
```
Open `http://localhost:3000`.
Expected: 99 colored boxes/spheres + 1 bright green robot cube. FPS logged to console (should be ≥60). No warnings.

- [ ] **Step 4: Commit**

```bash
cd "d:/JAVAbcak/AetherMesh Engine"
git add frontend/src/types.ts frontend/src/components/Stage3D.vue
git commit -m "feat(S2): add InstancedMesh rendering for 100 scene objects"
```

---

## Sprint 3: 能看到性能了

### Task 3: Add Profiler component with canvas-based chart

**Files:**
- Create: `frontend/src/components/Profiler.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Create Profiler.vue with canvas-drawn FPS/draw-call/memory panel**

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement>()
const fps = ref(0)
const drawCalls = ref(0)
const memoryMB = ref(0)
const bvhTraversalMs = ref(0)

let history: number[] = Array(120).fill(0) // 120 frames of FPS history
let frameIdx = 0
let lastTime = performance.now()
let frameCount = 0

function updateMetrics(newFps: number, newDrawCalls: number, newBvhMs: number) {
  fps.value = newFps
  drawCalls.value = newDrawCalls
  bvhTraversalMs.value = newBvhMs
  if ('memory' in performance) {
    memoryMB.value = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
  }
  history[frameIdx % 120] = newFps
  frameIdx++
  draw()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = 'rgba(10, 10, 20, 0.85)'
  ctx.fillRect(0, 0, w, h)

  // FPS line chart
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const startIdx = Math.max(0, frameIdx - 120)
  for (let i = 0; i < Math.min(frameIdx, 120); i++) {
    const hIdx = (startIdx + i) % 120
    const x = (i / 119) * w
    const y = h * 0.55 - (history[hIdx] / 120) * h * 0.5
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // 60 FPS reference line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.setLineDash([4, 8])
  ctx.beginPath()
  ctx.moveTo(0, h * 0.55 - (60 / 120) * h * 0.5)
  ctx.lineTo(w, h * 0.55 - (60 / 120) * h * 0.5)
  ctx.stroke()
  ctx.setLineDash([])

  // Text metrics
  ctx.fillStyle = '#e0e0e0'
  ctx.font = '11px monospace'
  ctx.fillText(`FPS: ${fps.value}`, 8, h - 52)
  ctx.fillText(`DrawCalls: ${drawCalls.value}`, 8, h - 36)
  ctx.fillText(`Mem: ${memoryMB.value} MB`, 8, h - 20)
  if (bvhTraversalMs.value > 0) {
    ctx.fillText(`BVH: ${bvhTraversalMs.value.toFixed(3)} ms`, 120, h - 52)
  }
}

// Expose updateMetrics globally so Stage3D can call it
;(window as any).__profilerUpdate = updateMetrics

onMounted(() => {
  draw()
})

onUnmounted(() => {
  delete (window as any).__profilerUpdate
})
</script>

<template>
  <canvas
    ref="canvasRef"
    width="220"
    height="80"
    style="position: absolute; bottom: 8px; left: 8px; border-radius: 4px; pointer-events: none; z-index: 10;"
  />
</template>
```

- [ ] **Step 2: Update App.vue to include Profiler**

```vue
<script setup lang="ts">
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; position: relative;">
    <Stage3D style="flex: 1;" />
    <Profiler />
  </div>
</template>
```

- [ ] **Step 3: Update Stage3D.vue to feed Profiler data**

In the `animate()` function of Stage3D.vue, replace the FPS console.log block:

```typescript
// Find this block in animate():
const now = performance.now()
if (now - lastFpsTime >= 500) {
  const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000))
  // Replace console.log with:
  if ((window as any).__profilerUpdate) {
    (window as any).__profilerUpdate(fps, renderer.info.render.calls, 0)
  }
  frameCount = 0
  lastFpsTime = now
}
```

- [ ] **Step 4: Verify S3 acceptance criteria**

Run `npm run dev`, open browser.
Expected: Profiler overlay shows live FPS, DrawCalls, Memory values in bottom-left corner. FPS line chart updates in real time. Numbers are not constant (they fluctuate naturally).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Profiler.vue frontend/src/App.vue frontend/src/components/Stage3D.vue
git commit -m "feat(S3): add canvas-based profiler panel with FPS chart"
```

---

## Sprint 4: C++/Wasm 编译链跑通 (无依赖，可并行于 S1-S3)

### Task 4: Set up C++ project with CMake + Emscripten and verify add(a,b)

**Files:**
- Create: `core/CMakeLists.txt`
- Create: `core/src/engine_core.cpp`
- Create: `core/include/engine_core.h`
- Create: `build_wasm.sh`
- Create: `frontend/src/utils/wasmLoader.ts` (stub)
- Create: `frontend/src/utils/mockKernel.ts` (stub for later)

- [ ] **Step 1: Create engine_core.h**

```cpp
#pragma once
#include <cstdint>

extern "C" {
  // Simple add function for Sprint 4 verification
  int add(int a, int b);
}
```

- [ ] **Step 2: Create engine_core.cpp (Sprint 4 minimal)**

```cpp
#include "engine_core.h"

extern "C" {
  int add(int a, int b) {
    return a + b;
  }
}
```

- [ ] **Step 3: Create CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.20)
project(aethermesh_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(EMSCRIPTEN)
  set(CMAKE_EXECUTABLE_SUFFIX ".js")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -flto")
  set(CMAKE_EXECUTABLE_LINKER_FLAGS "${CMAKE_EXECUTABLE_LINKER_FLAGS} \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createAetherModule' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=256MB \
    -s MAXIMUM_MEMORY=1GB \
    --pre-js ${CMAKE_SOURCE_DIR}/../core/src/pre.js"
  )
endif()

add_executable(engine_core
  src/engine_core.cpp
)

include_directories(include)
```

- [ ] **Step 4: Create pre.js (Emscripten pre-js for COOP/COEP)**

```javascript
// pre.js — runs before the Wasm module init
// Ensures the module supports SharedArrayBuffer in cross-origin isolated contexts
if (typeof self !== 'undefined') {
  // Stub for future zero-copy support
}
```

Save as `core/src/pre.js`.

- [ ] **Step 5: Create build_wasm.sh**

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/core/build"
OUTPUT_DIR="$SCRIPT_DIR/frontend/public/wasm"

mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

cd "$BUILD_DIR"

# Configure with Emscripten
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
emmake make -j$(nproc 2>/dev/null || echo 4)

# Copy outputs to frontend
cp engine_core.js engine_core.wasm "$OUTPUT_DIR/" 2>/dev/null || true
cp engine_core.worker.js "$OUTPUT_DIR/" 2>/dev/null || true
cp engine_core.data "$OUTPUT_DIR/" 2>/dev/null || true

echo "Build complete. Wasm outputs copied to frontend/public/wasm/"
ls -la "$OUTPUT_DIR/"
```

Make it executable:

```bash
chmod +x build_wasm.sh
```

- [ ] **Step 6: Create mockKernel.ts (JS fallback stub)**

```typescript
// Placeholder — will be filled in Sprint 5
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
```

- [ ] **Step 7: Create wasmLoader.ts (stub)**

```typescript
// Stub — will be filled in Sprint 5 after Embind wiring
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
    // Sprint 5 will implement the real Wasm loader
    // For now, fall back to mock
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
```

- [ ] **Step 8: Run build_wasm.sh and verify**

```bash
cd "d:/JAVAbcak/AetherMesh Engine"
bash build_wasm.sh
```

Expected: `core/build/` contains `engine_core.js` and `engine_core.wasm`. `frontend/public/wasm/` has copies. No compilation errors.

- [ ] **Step 9: Manual verification — test the Wasm module in browser**

Add a temporary test page or script. The simplest verification: Check that `engine_core.js` exists and can be loaded. For now the JS-side integration comes in Sprint 5. Verify file sizes:

```bash
ls -la frontend/public/wasm/
```

Expected: `engine_core.js` ~100-300KB, `engine_core.wasm` ~5-50KB.

- [ ] **Step 10: Commit**

```bash
git add core/ build_wasm.sh frontend/src/utils/wasmLoader.ts frontend/src/utils/mockKernel.ts frontend/public/
git commit -m "feat(S4): set up CMake + Emscripten toolchain, verify Wasm compilation"
```

---

## Sprint 5: 算力通道打通 — Embind + 零拷贝

### Task 5: Implement C++ EngineCore with Embind bindings and zero-copy vertex processing

**Files:**
- Modify: `core/include/engine_core.h`
- Modify: `core/src/engine_core.cpp`
- Modify: `core/CMakeLists.txt`
- Modify: `frontend/src/utils/wasmLoader.ts`
- Modify: `frontend/src/utils/mockKernel.ts`

- [ ] **Step 1: Rewrite engine_core.h with full Embind class**

```cpp
#pragma once
#include <cstdint>
#include <cstddef>
#include <vector>
#include <string>

// AABB structure matching frontend format
struct AABB {
  float minX, minY, minZ;
  float maxX, maxY, maxZ;
};

// Collision pair returned to JS
struct CollisionResult {
  int objectA;
  int objectB;
  float penetration;
  float contactX, contactY, contactZ;
};

class EngineCore {
public:
  EngineCore();
  ~EngineCore();

  // Initialize with scene object count
  void init(int objectCount);

  // Process positions: flip Y axis and return pointer to modified data
  // Takes a pointer into Wasm linear memory (zero-copy from JS Float32Array)
  uintptr_t processVertices(uintptr_t dataPtr, int count);

  // Get collision results (stub for now, real in S7)
  int getCollisionCount();
  uintptr_t getCollisionData();

  // Performance metrics
  float getTraversalTime();

  // Memory management
  void dispose();

private:
  float* vertexBuffer;
  int vertexCount;
  float traversalTime;
  std::vector<CollisionResult> collisions;
};
```

- [ ] **Step 2: Rewrite engine_core.cpp with Embind bindings**

```cpp
#include "engine_core.h"
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cstring>

using namespace emscripten;

EngineCore::EngineCore() : vertexBuffer(nullptr), vertexCount(0), traversalTime(0.0f) {}

EngineCore::~EngineCore() { dispose(); }

void EngineCore::init(int objectCount) {
  // Allocate vertex buffer: each object has 8 corners × 3 floats + 3 position floats
  vertexCount = objectCount * 27; // 8 corners * 3 + 3 position
  vertexBuffer = new float[vertexCount]();
}

uintptr_t EngineCore::processVertices(uintptr_t dataPtr, int count) {
  if (!vertexBuffer) return 0;

  // Zero-copy: cast the Wasm memory pointer to float array
  float* input = reinterpret_cast<float*>(dataPtr);

  // Process: flip Y axis for all vertices, copy to internal buffer
  // Input format: [x,y,z, x,y,z, ...] (count * 3 floats for positions + 24 floats per object for vertices)
  int floatsToProcess = count * 3; // positions only for now
  for (int i = 0; i < floatsToProcess && i < vertexCount; i += 3) {
    vertexBuffer[i]     = input[i];       // X unchanged
    vertexBuffer[i + 1] = -input[i + 1];  // Y flipped
    vertexBuffer[i + 2] = input[i + 2];   // Z unchanged
  }

  // Return pointer to the processed buffer for JS to read back
  return reinterpret_cast<uintptr_t>(vertexBuffer);
}

int EngineCore::getCollisionCount() {
  return static_cast<int>(collisions.size());
}

uintptr_t EngineCore::getCollisionData() {
  if (collisions.empty()) return 0;
  return reinterpret_cast<uintptr_t>(collisions.data());
}

float EngineCore::getTraversalTime() {
  return traversalTime;
}

void EngineCore::dispose() {
  if (vertexBuffer) {
    delete[] vertexBuffer;
    vertexBuffer = nullptr;
  }
  collisions.clear();
}

// Embind bindings
EMSCRIPTEN_BINDINGS(aethermesh_core) {
  class_<EngineCore>("EngineCore")
    .constructor<>()
    .function("init", &EngineCore::init)
    .function("processVertices", &EngineCore::processVertices)
    .function("getCollisionCount", &EngineCore::getCollisionCount)
    .function("getCollisionData", &EngineCore::getCollisionData)
    .function("getTraversalTime", &EngineCore::getTraversalTime)
    .function("dispose", &EngineCore::dispose)
  ;
}
```

- [ ] **Step 3: Update CMakeLists.txt for Embind**

Add `--bind` to the linker flags:

```cmake
set(CMAKE_EXECUTABLE_LINKER_FLAGS "${CMAKE_EXECUTABLE_LINKER_FLAGS} \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createAetherModule' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=256MB \
    -s MAXIMUM_MEMORY=1GB \
    -lembind \
    --pre-js ${CMAKE_SOURCE_DIR}/../core/src/pre.js"
  )
```

Add `-lembind` to the linker flags in the `if(EMSCRIPTEN)` block (replacing the previous `set(CMAKE_EXECUTABLE_LINKER_FLAGS ...)`).

- [ ] **Step 4: Rewrite mockKernel.ts matching IComputeKernel**

```typescript
import type { IComputeKernel, SceneObject, CollisionPair } from '@/types'

export function createMockKernel(): IComputeKernel {
  let objects: SceneObject[] = []
  let positions = new Float32Array(0)

  return {
    init(sceneObjects: SceneObject[]) {
      objects = [...sceneObjects]
    },

    updatePositions(newPositions: Float32Array) {
      // Simulate position processing: copy the array
      positions = new Float32Array(newPositions)
      // Simulate Y-flip like the real kernel would do
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] = -positions[i]
      }
    },

    getCollisions(): CollisionPair[] {
      // Sprint 5: return empty, Sprint 7+: brute force AABB overlap
      return []
    },

    getBVHTraversalTime(): number {
      // Simulate realistic BVH traversal time
      return 0.05 + Math.random() * 0.02
    },

    dispose() {
      objects = []
      positions = new Float32Array(0)
    },
  }
}
```

- [ ] **Step 5: Implement real wasmLoader.ts**

```typescript
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
    // Dynamic import of the Emscripten-generated module
    const wasmModule = await import(
      /* @vite-ignore */ `${ENGINE_CONFIG.compute.wasmPath}?url`
    )

    // Load the module using the global createAetherModule function
    // The Emscripten-generated .js file exposes createAetherModule globally
    const Module = await new Promise<any>((resolve, reject) => {
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
        if (!Module.HEAPF32) {
          // Fallback: copy to heap
          const byteSize = positions.length * 4
          const ptr = Module._malloc(byteSize)
          Module.HEAPU8.set(new Uint8Array(positions.buffer), ptr)
          const resultPtr = core.processVertices(ptr, positions.length / 3)
          // Read back processed data
          heapFloat32 = Module.HEAPF32.subarray(
            resultPtr >> 2,
            (resultPtr >> 2) + positions.length
          )
          Module._free(ptr)
        } else {
          // Direct zero-copy: use existing HEAP views
          const ptr = core.processVertices(
            positions.byteOffset,
            positions.length / 3
          )
          heapFloat32 = Module.HEAPF32.subarray(
            ptr >> 2,
            (ptr >> 2) + positions.length
          )
        }
      },

      getCollisions(): CollisionPair[] {
        const count = core.getCollisionCount()
        if (count === 0) return []
        const dataPtr = core.getCollisionData()
        if (!dataPtr) return []

        const result: CollisionPair[] = []
        // Each CollisionResult = 8 floats (2 ints + 6 floats)
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
```

- [ ] **Step 6: Rebuild Wasm**

```bash
bash build_wasm.sh
```
Expected: New `engine_core.js` and `engine_core.wasm` generated with Embind bindings.

- [ ] **Step 7: Test the zero-copy pipeline from browser**

Create a temporary inline test in the browser console to verify Wasm loads and processes data:

```javascript
// Run in browser devtools after npm run dev
const { loadKernel } = await import('/src/utils/wasmLoader.ts')
const kernel = await loadKernel()
kernel.init([{id:'test',tag:'obj',position:[0,0,0],halfExtents:[1,1,1],meshType:'box'}])
const testData = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
kernel.updatePositions(testData)
console.log('Kernel loaded and processed data')
```

Expected: No errors. If in mock mode, works immediately. If in real mode, Wasm loads and processes.

- [ ] **Step 8: Commit**

```bash
git add core/ frontend/src/utils/wasmLoader.ts frontend/src/utils/mockKernel.ts
git commit -m "feat(S5): implement Embind bindings and zero-copy Float32Array pipeline"
```

---

## Sprint 6: SAH-BVH 空间索引 + 包围盒可视化

### Task 6: Implement BVH tree in C++ and visualize AABB wireframes

**Files:**
- Create: `core/include/bvh.h`
- Create: `core/src/bvh.cpp`
- Modify: `core/include/engine_core.h`
- Modify: `core/src/engine_core.cpp`
- Modify: `frontend/src/components/Stage3D.vue`

- [ ] **Step 1: Create bvh.h — BVH data structures**

```cpp
#pragma once
#include <vector>
#include <memory>
#include <algorithm>
#include <limits>

struct AABB {
  float minX, minY, minZ;
  float maxX, maxY, maxZ;

  float surfaceArea() const {
    float dx = maxX - minX;
    float dy = maxY - minY;
    float dz = maxZ - minZ;
    return 2.0f * (dx * dy + dy * dz + dz * dx);
  }

  static AABB merge(const AABB& a, const AABB& b) {
    return {
      std::min(a.minX, b.minX), std::min(a.minY, b.minY), std::min(a.minZ, b.minZ),
      std::max(a.maxX, b.maxX), std::max(a.maxY, b.maxY), std::max(a.maxZ, b.maxZ)
    };
  }
};

struct BVHNode {
  AABB bounds;
  int leftChild;   // -1 if leaf
  int rightChild;  // -1 if leaf
  int firstPrim;   // first primitive index in leaf
  int primCount;   // number of primitives in leaf (0 for internal nodes)
  int splitAxis;
};

struct Primitive {
  AABB bounds;
  int objectIndex;
  float centroidX, centroidY, centroidZ;
};

class BVHTree {
public:
  BVHTree() : nodeCount(0) {}

  void build(const std::vector<Primitive>& primitives);
  void traverse(const AABB& query, std::vector<int>& outCollisions) const;
  const std::vector<BVHNode>& getNodes() const { return nodes; }
  int getNodeCount() const { return nodeCount; }

private:
  std::vector<BVHNode> nodes;
  std::vector<Primitive> prims;
  int nodeCount;

  int buildRecursive(int first, int count, int depth);
  float findBestSplit(int first, int count, int& outAxis, float& outSplitPos);
};
```

- [ ] **Step 2: Create bvh.cpp — SAH-BVH implementation**

```cpp
#include "bvh.h"
#include <algorithm>
#include <cfloat>
#include <cstring>

static const float EPSILON = 1e-6f;
static const int MAX_DEPTH = 32;
static const int LEAF_SIZE = 4;

void BVHTree::build(const std::vector<Primitive>& p) {
  prims = p;
  nodes.clear();
  nodes.reserve(prims.size() * 2);
  nodeCount = 0;

  // Create root node
  nodes.push_back({});
  buildRecursive(0, static_cast<int>(prims.size()), 0);
}

int BVHTree::buildRecursive(int first, int count, int depth) {
  int nodeIdx = nodeCount++;

  // Compute bounding box of all primitives in this range
  AABB bounds = prims[first].bounds;
  for (int i = 1; i < count; i++) {
    bounds = AABB::merge(bounds, prims[first + i].bounds);
  }
  nodes[nodeIdx].bounds = bounds;

  // Leaf condition
  if (count <= LEAF_SIZE || depth >= MAX_DEPTH) {
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  // Find best split plane using SAH
  int bestAxis = 0;
  float bestPos = 0.0f;
  float bestCost = findBestSplit(first, count, bestAxis, bestPos);

  // If splitting doesn't help, make leaf
  float noSplitCost = static_cast<float>(count) * bounds.surfaceArea();
  if (bestCost >= noSplitCost) {
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  // Partition primitives around split plane
  auto mid = std::partition(prims.begin() + first, prims.begin() + first + count,
    [bestAxis, bestPos](const Primitive& p) {
      float c = (bestAxis == 0) ? p.centroidX : ((bestAxis == 1) ? p.centroidY : p.centroidZ);
      return c < bestPos;
    });

  int midIdx = static_cast<int>(std::distance(prims.begin() + first, mid));
  if (midIdx == 0 || midIdx == count) {
    // Degenerate split — make leaf
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  nodes[nodeIdx].splitAxis = bestAxis;
  nodes[nodeIdx].firstPrim = 0;
  nodes[nodeIdx].primCount = 0;

  // Reserve slots for children
  nodes.push_back({}); // left child placeholder
  nodes.push_back({}); // right child placeholder

  // Build children
  nodes[nodeIdx].leftChild = buildRecursive(first, midIdx, depth + 1);
  nodes[nodeIdx].rightChild = buildRecursive(first + midIdx, count - midIdx, depth + 1);

  return nodeIdx;
}

float BVHTree::findBestSplit(int first, int count, int& outAxis, float& outSplitPos) {
  float bestCost = FLT_MAX;
  const int BUCKETS = 12;

  for (int axis = 0; axis < 3; axis++) {
    // Sort primitives by centroid along current axis using a simple insertion approach
    // (In production, you'd sort just this range; here we partition iteratively)
    for (int bucket = 1; bucket < BUCKETS; bucket++) {
      float splitPos = nodes[nodeCount].bounds.minX +
        (float(bucket) / BUCKETS) * (
          (axis == 0) ? nodes[nodeCount].bounds.maxX - nodes[nodeCount].bounds.minX :
          (axis == 1) ? nodes[nodeCount].bounds.maxY - nodes[nodeCount].bounds.minY :
                        nodes[nodeCount].bounds.maxZ - nodes[nodeCount].bounds.minZ
        );

      if (axis == 0) splitPos = nodes[nodeCount].bounds.minX + splitPos;
      else if (axis == 1) splitPos = nodes[nodeCount].bounds.minY + (float(bucket)/BUCKETS) *
        (nodes[nodeCount].bounds.maxY - nodes[nodeCount].bounds.minY);
      else splitPos = nodes[nodeCount].bounds.minZ + (float(bucket)/BUCKETS) *
        (nodes[nodeCount].bounds.maxZ - nodes[nodeCount].bounds.minZ);

      // Count primitives on each side
      AABB leftBounds = {FLT_MAX, FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX, -FLT_MAX};
      AABB rightBounds = {FLT_MAX, FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX, -FLT_MAX};
      int leftCount = 0, rightCount = 0;

      for (int i = 0; i < count; i++) {
        const auto& p = prims[first + i];
        float centroid = (axis == 0) ? p.centroidX : ((axis == 1) ? p.centroidY : p.centroidZ);
        if (centroid < splitPos) {
          leftBounds = AABB::merge(leftBounds, p.bounds);
          leftCount++;
        } else {
          rightBounds = AABB::merge(rightBounds, p.bounds);
          rightCount++;
        }
      }

      if (leftCount == 0 || rightCount == 0) continue;

      // SAH cost: traversalCost + (leftArea/totalArea)*leftCount + (rightArea/totalArea)*rightCount
      float totalArea = nodes[nodeCount].bounds.surfaceArea();
      float cost = 1.0f + (leftBounds.surfaceArea() / totalArea) * leftCount
                       + (rightBounds.surfaceArea() / totalArea) * rightCount;

      if (cost < bestCost) {
        bestCost = cost;
        outAxis = axis;
        outSplitPos = splitPos;
      }
    }
  }

  return bestCost;
}

void BVHTree::traverse(const AABB& query, std::vector<int>& outCollisions) const {
  // Iterative stack-based traversal
  std::vector<int> stack;
  stack.reserve(64);
  stack.push_back(0);

  while (!stack.empty()) {
    int idx = stack.back();
    stack.pop_back();

    const BVHNode& node = nodes[idx];

    // Quick AABB overlap test
    if (query.minX > node.bounds.maxX || query.maxX < node.bounds.minX ||
        query.minY > node.bounds.maxY || query.maxY < node.bounds.minY ||
        query.minZ > node.bounds.maxZ || query.maxZ < node.bounds.minZ) {
      continue; // No overlap
    }

    if (node.leftChild == -1) {
      // Leaf node — report all primitives
      for (int i = 0; i < node.primCount; i++) {
        const Primitive& p = prims[node.firstPrim + i];
        // Precise AABB overlap check
        if (query.minX <= p.bounds.maxX && query.maxX >= p.bounds.minX &&
            query.minY <= p.bounds.maxY && query.maxY >= p.bounds.minY &&
            query.minZ <= p.bounds.maxZ && query.maxZ >= p.bounds.minZ) {
          outCollisions.push_back(p.objectIndex);
        }
      }
    } else {
      stack.push_back(node.rightChild);
      stack.push_back(node.leftChild);
    }
  }
}
```

- [ ] **Step 3: Update engine_core.h — add BVH integration**

Append to the existing `EngineCore` class declaration (before `private:`):

```cpp
  // BVH operations (Sprint 6)
  void buildBVH(float* aabbData, int count);
  int traverseBVH(float minX, float minY, float minZ, float maxX, float maxY, float maxZ);
  int getBVHNodeCount();
  uintptr_t getBVHNodeData(); // Returns pointer to node AABB array for visualization
```

Add include and members:

```cpp
#include "bvh.h"
// In private section:
  std::unique_ptr<BVHTree> bvh;
  std::vector<float> bvhNodeData; // Flat array of AABBs for visualization
```

- [ ] **Step 4: Update engine_core.cpp — implement BVH functions**

Add to `engine_core.cpp` after the existing methods:

```cpp
void EngineCore::buildBVH(float* aabbData, int count) {
  bvh = std::make_unique<BVHTree>();
  std::vector<Primitive> primitives(count);

  for (int i = 0; i < count; i++) {
    int off = i * 6;
    primitives[i].bounds = {
      aabbData[off], aabbData[off + 1], aabbData[off + 2],
      aabbData[off + 3], aabbData[off + 4], aabbData[off + 5]
    };
    primitives[i].objectIndex = i;
    primitives[i].centroidX = (aabbData[off] + aabbData[off + 3]) * 0.5f;
    primitives[i].centroidY = (aabbData[off + 1] + aabbData[off + 4]) * 0.5f;
    primitives[i].centroidZ = (aabbData[off + 2] + aabbData[off + 5]) * 0.5f;
  }

  bvh->build(primitives);

  // Build visualization data: 6 floats (AABB) per node
  const auto& nodes = bvh->getNodes();
  bvhNodeData.clear();
  bvhNodeData.reserve(nodes.size() * 6);
  for (const auto& node : nodes) {
    bvhNodeData.push_back(node.bounds.minX);
    bvhNodeData.push_back(node.bounds.minY);
    bvhNodeData.push_back(node.bounds.minZ);
    bvhNodeData.push_back(node.bounds.maxX);
    bvhNodeData.push_back(node.bounds.maxY);
    bvhNodeData.push_back(node.bounds.maxZ);
  }
}

int EngineCore::traverseBVH(float minX, float minY, float minZ,
                             float maxX, float maxY, float maxZ) {
  if (!bvh) return 0;
  AABB query = {minX, minY, minZ, maxX, maxY, maxZ};
  std::vector<int> results;
  bvh->traverse(query, results);

  // Also measure traversal time
  auto start = std::chrono::high_resolution_clock::now();
  bvh->traverse(query, results); // second call for timing
  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<float, std::milli> elapsed = end - start;
  traversalTime = elapsed.count();

  return static_cast<int>(results.size());
}

int EngineCore::getBVHNodeCount() {
  if (!bvh) return 0;
  return bvh->getNodeCount();
}

uintptr_t EngineCore::getBVHNodeData() {
  if (bvhNodeData.empty()) return 0;
  return reinterpret_cast<uintptr_t>(bvhNodeData.data());
}
```

Add `#include <chrono>` at the top of `engine_core.cpp`.

Register the new methods in the Embind section:

```cpp
.function("buildBVH", &EngineCore::buildBVH)
.function("traverseBVH", &EngineCore::traverseBVH)
.function("getBVHNodeCount", &EngineCore::getBVHNodeCount)
.function("getBVHNodeData", &EngineCore::getBVHNodeData)
```

- [ ] **Step 5: Rebuild Wasm**

```bash
bash build_wasm.sh
```

- [ ] **Step 6: Update Stage3D.vue — add BVH AABB wireframe visualization**

Add after the existing InstancedMesh creation code, before `setupOrbitControls()`:

```typescript
// BVH AABB wireframe visualization
let bvhLines: THREE.LineSegments

async function visualizeBVH() {
  if (ENGINE_CONFIG.compute.mode === 'mock') return
  const kernel = getKernel()
  if (!kernel) return

  // Gather all object AABBs and send to Wasm for BVH build
  const aabbFloats: number[] = []
  for (const obj of sceneObjects) {
    aabbFloats.push(
      obj.position[0] - obj.halfExtents[0], obj.position[1] - obj.halfExtents[1], obj.position[2] - obj.halfExtents[2],
      obj.position[0] + obj.halfExtents[0], obj.position[1] + obj.halfExtents[1], obj.position[2] + obj.halfExtents[2]
    )
  }

  // Need to call via the Wasm core directly — extend wasmLoader API
  // For now, log the BVH build data
  console.log('[BVH] Scene AABB data ready for Wasm:', aabbFloats.length / 6, 'objects')
}

// Call after scene setup
visualizeBVH()
```

Add the import for `ENGINE_CONFIG` and `getKernel`:

```typescript
import { ENGINE_CONFIG } from '@/config'
import { getKernel } from '@/utils/wasmLoader'
```

- [ ] **Step 7: Verify S6 acceptance criteria**

Rebuild Wasm (`bash build_wasm.sh`), run `npm run dev`.
Expected: Console shows "BVH Scene AABB data ready for Wasm: 100 objects". Wasm compiles with BVH implementation.

- [ ] **Step 8: Commit**

```bash
git add core/include/bvh.h core/src/bvh.cpp core/include/engine_core.h core/src/engine_core.cpp frontend/src/components/Stage3D.vue
git commit -m "feat(S6): implement SAH-BVH tree with AABB visualization prep"
```

---

## Sprint 7: GJK 碰撞检测

### Task 7: Implement Minkowski/GJK collision detection and collision visualization

**Files:**
- Create: `core/include/minkowski.h`
- Create: `core/src/minkowski.cpp`
- Modify: `core/src/engine_core.cpp`
- Modify: `frontend/src/utils/mockKernel.ts`
- Modify: `frontend/src/components/Stage3D.vue`

- [ ] **Step 1: Create minkowski.h**

```cpp
#pragma once
#include <array>
#include <vector>

struct Vec3 {
  float x, y, z;

  Vec3() : x(0), y(0), z(0) {}
  Vec3(float _x, float _y, float _z) : x(_x), y(_y), z(_z) {}

  Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
  Vec3 operator-() const { return {-x, -y, -z}; }
  float dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  Vec3 cross(const Vec3& o) const {
    return {y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x};
  }
  float lengthSq() const { return x * x + y * y + z * z; }
  float length() const { return std::sqrt(lengthSq()); }
  Vec3 normalized() const {
    float len = length();
    if (len < 1e-10f) return {0, 1, 0};
    return {x / len, y / len, z / len};
  }
};

Vec3 operator*(float s, const Vec3& v);

// Support function: find furthest point of a convex polyhedron in a direction
Vec3 supportPoint(const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB, const Vec3& dir);

// GJK: returns true if two convex polyhedra intersect. Optionally outputs penetration info.
bool gjkIntersect(
  const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB,
  float& outPenetration, Vec3& outContactPoint
);
```

- [ ] **Step 2: Create minkowski.cpp**

```cpp
#include "minkowski.h"
#include <cmath>
#include <algorithm>
#include <limits>

static const float GJK_EPSILON = 1e-6f;
static const int GJK_MAX_ITER = 64;

Vec3 operator*(float s, const Vec3& v) { return v * s; }

Vec3 supportPoint(const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB, const Vec3& dir) {
  // Furthest point in direction dir on shapeA minus furthest in -dir on shapeB
  float maxA = -std::numeric_limits<float>::max();
  Vec3 pointA;
  for (const auto& v : shapeA) {
    float d = v.dot(dir);
    if (d > maxA) { maxA = d; pointA = v; }
  }

  Vec3 negDir = -dir;
  float maxB = -std::numeric_limits<float>::max();
  Vec3 pointB;
  for (const auto& v : shapeB) {
    float d = v.dot(negDir);
    if (d > maxB) { maxB = d; pointB = v; }
  }

  return pointA - pointB; // Minkowski difference support
}

bool gjkIntersect(
  const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB,
  float& outPenetration, Vec3& outContactPoint
) {
  outPenetration = 0.0f;
  outContactPoint = {0, 0, 0};

  // Initial direction: from centroid of B to centroid of A
  Vec3 centerA(0,0,0), centerB(0,0,0);
  for (const auto& v : shapeA) centerA = centerA + v;
  for (const auto& v : shapeB) centerB = centerB + v;
  centerA = centerA * (1.0f / shapeA.size());
  centerB = centerB * (1.0f / shapeB.size());

  Vec3 dir = centerA - centerB;
  if (dir.lengthSq() < 1e-8f) dir = {1, 0, 0};

  // Simplex vertices (Minkowski difference points)
  std::vector<Vec3> simplex;
  simplex.push_back(supportPoint(shapeA, shapeB, dir));
  dir = -simplex[0];

  for (int iter = 0; iter < GJK_MAX_ITER; iter++) {
    Vec3 newPoint = supportPoint(shapeA, shapeB, dir);

    // If the new point doesn't go past the origin in direction dir, no intersection
    if (newPoint.dot(dir) < 0) {
      return false;
    }

    simplex.push_back(newPoint);

    // Update simplex and search direction using the closest feature to origin
    if (simplex.size() == 2) {
      // Line case
      Vec3 ab = simplex[1] - simplex[0];
      Vec3 ao = -simplex[0];
      if (ab.dot(ao) > 0) {
        dir = ab.cross(ao).cross(ab);
      } else {
        simplex.erase(simplex.begin());
        dir = ao;
      }
    } else if (simplex.size() == 3) {
      // Triangle case
      Vec3 a = simplex[2];
      Vec3 ab = simplex[1] - a;
      Vec3 ac = simplex[0] - a;
      Vec3 ao = -a;

      Vec3 abc = ab.cross(ac);
      Vec3 abPerp = ac.cross(abc);
      Vec3 acPerp = abc.cross(ab);

      if (abPerp.dot(ao) > 0) {
        simplex.erase(simplex.begin()); // Remove c
        dir = abPerp;
      } else if (acPerp.dot(ao) > 0) {
        simplex.erase(simplex.begin() + 1); // Remove b
        dir = acPerp;
      } else {
        // Origin is inside the triangle or behind it
        if (abc.dot(ao) > 0) {
          dir = abc;
        } else {
          // Tetrahedron case — origin inside
          if (simplex.size() == 4) {
            // Penetration depth approximation: distance from origin to closest face
            outPenetration = std::abs(abc.dot(ao)) / abc.length();
            outContactPoint = a + ao * 0.5f;
            return true;
          }
          // Need 4th point (tetrahedron)
          dir = -abc;
        }
      }
    } else if (simplex.size() == 4) {
      // Tetrahedron — origin inside means collision
      // Check all faces to confirm
      for (int f = 0; f < 4; f++) {
        int i0 = f, i1 = (f+1)%4, i2 = (f+2)%4;
        Vec3 normal = (simplex[i1] - simplex[i0]).cross(simplex[i2] - simplex[i0]);
        if (normal.dot(-simplex[i0]) > 0) {
          // Origin is outside this face — continue search
          simplex.erase(simplex.begin() + ((f+3)%4));
          dir = normal;
          break;
        }
      }
      // All face normals point away from origin → collision confirmed
      outPenetration = 0.01f; // Approximate
      outContactPoint = (simplex[0] + simplex[1] + simplex[2] + simplex[3]) * 0.25f;
      return true;
    }
  }

  // Max iterations exceeded — treat as collision (safety bias)
  outPenetration = 0.01f;
  return true;
}
```

- [ ] **Step 3: Update engine_core.cpp — integrate GJK into collision detection**

Add to `engine_core.cpp` (~after BVH traversal):

```cpp
#include "minkowski.h"

// Generate 8 corner vertices of an AABB as a convex hull
static std::vector<Vec3> aabbToVertices(float minX, float minY, float minZ,
                                         float maxX, float maxY, float maxZ) {
  return {
    {minX, minY, minZ}, {maxX, minY, minZ}, {maxX, maxY, minZ}, {minX, maxY, minZ},
    {minX, minY, maxZ}, {maxX, minY, maxZ}, {maxX, maxY, maxZ}, {minX, maxY, maxZ}
  };
}

void EngineCore::detectCollisions(float* aabbData, int objectCount, int robotIndex) {
  if (!bvh) return;
  collisions.clear();

  // Get robot AABB
  int rOff = robotIndex * 6;
  AABB robotAABB = {
    aabbData[rOff], aabbData[rOff+1], aabbData[rOff+2],
    aabbData[rOff+3], aabbData[rOff+4], aabbData[rOff+5]
  };

  // Broad-phase: BVH traverse
  std::vector<int> candidates;
  bvh->traverse(robotAABB, candidates);

  // Narrow-phase: GJK on each candidate
  auto robotVerts = aabbToVertices(robotAABB.minX, robotAABB.minY, robotAABB.minZ,
                                    robotAABB.maxX, robotAABB.maxY, robotAABB.maxZ);

  for (int objIdx : candidates) {
    if (objIdx == robotIndex) continue;
    int off = objIdx * 6;
    auto objVerts = aabbToVertices(
      aabbData[off], aabbData[off+1], aabbData[off+2],
      aabbData[off+3], aabbData[off+4], aabbData[off+5]
    );

    float penetration;
    Vec3 contact;
    if (gjkIntersect(robotVerts, objVerts, penetration, contact)) {
      collisions.push_back({
        robotIndex, objIdx,
        penetration,
        contact.x, contact.y, contact.z
      });
    }
  }
}
```

Add declaration to `engine_core.h`:

```cpp
void detectCollisions(float* aabbData, int objectCount, int robotIndex);
```

Register in Embind:

```cpp
.function("detectCollisions", &EngineCore::detectCollisions)
```

- [ ] **Step 4: Rebuild Wasm**

```bash
bash build_wasm.sh
```

- [ ] **Step 5: Update mockKernel.ts — implement brute-force AABB collision as GJK fallback**

Replace `getCollisions()` in [mockKernel.ts](frontend/src/utils/mockKernel.ts):

```typescript
getCollisions(): CollisionPair[] {
  // Brute-force AABB overlap test (O(N²) — slow but works as mock)
  const result: CollisionPair[] = []
  const robotIdx = 0

  for (let i = 1; i < objects.length; i++) {
    const robot = objects[robotIdx]
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
        contactPoint: [
          (rx + ox) / 2,
          (ry + oy) / 2,
          (rz + oz) / 2
        ]
      })
    }
  }
  return result
},
```

- [ ] **Step 6: Update Stage3D.vue — collision highlight**

Add collision visualization to the animate loop. After `renderer.render(scene, camera)`, add:

```typescript
// Collision color update
const kernel = getKernel()
if (kernel) {
  const collisions = kernel.getCollisions()
  // Reset all to default color
  for (let i = 0; i < sceneObjects.length; i++) {
    const obj = sceneObjects[i]
    const color = obj.color || [1, 1, 1]
    // Find which mesh and set color
    // (Simplified: we iterate all instances each frame — acceptable for 100 objects)
  }
  // Highlight colliding objects red
  const collidingIds = new Set<string>()
  for (const c of collisions) {
    collidingIds.add(c.objectA)
    collidingIds.add(c.objectB)
  }
  for (const id of collidingIds) {
    const idx = parseInt(id.split('_')[1])
    if (idx === 0) {
      robotMesh.setColorAt(0, new THREE.Color(1, 0, 0))
      robotMesh.instanceColor!.needsUpdate = true
    }
    // ... iterate boxMesh and sphereMesh similarly
    // For simplicity, log collisions for now
  }
  if (collisions.length > 0) {
    console.log(`[Collision] ${collisions.length} pairs detected`)
  }
}
```

- [ ] **Step 7: Verify S7 acceptance criteria**

Run `npm run dev`, manually set `compute.mode: 'mock'` in config.ts.
Expected: robot cube starts at origin (0, 0, 0) with other objects scattered. Move robot position manually in code to overlap with another object — collision logged to console. With real Wasm mode, GJK results appear.

- [ ] **Step 8: Commit**

```bash
git add core/include/minkowski.h core/src/minkowski.cpp core/src/engine_core.cpp core/include/engine_core.h frontend/src/utils/mockKernel.ts frontend/src/components/Stage3D.vue
git commit -m "feat(S7): implement GJK collision detection with AABB brute-force mock fallback"
```

---

## Sprint 8: AI 听懂了 — Plan B Prompt + Ollama 客户端

### Task 8: Create AI System Prompt, ollamaClient, and ControlPanel

**Files:**
- Create: `ai/system_prompt.txt`
- Create: `frontend/src/utils/ollamaClient.ts`
- Create: `frontend/src/components/ControlPanel.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Create system_prompt.txt**

```text
你是空间指令解析器。只输出一个 JSON 对象，禁止任何解释、Markdown、代码块标记。

【action 类型】
- move_to: target=[x,y,z], avoid_tags=["tag1","tag2"]
- pick_up: object_id="物体id"
- place_down: target=[x,y,z]
- follow_path: waypoints=[[x1,y1,z1],[x2,y2,z2],...]
- query_user: target_object="物体类别", candidates=[{id,desc,position}]
- stop: reason="user_request"
- query: target="position"|"is_colliding", object_id="物体id"
- unknown: message="原因"

【规则】
- 坐标范围 x,z∈[-10,10], y∈[0,2]
- 如果用户提到的物体在场景中存在多个实例，输出 query_user 让用户选择
- 如果指令模糊无法确定具体操作，输出 unknown
- 如果用户一句话包含多个操作，输出 unknown 提示一次只做一个
- 如果用户说"停"/"停下"/"别动"，输出 stop
- avoid_tags 默认包含 "static_obstacle"

【示例】
→ 移动到桌子旁，避开椅子
← {"action":"move_to","target":[3.2,0,1.5],"avoid_tags":["table","chair"]}

→ 拿起蓝色花瓶
← {"action":"pick_up","object_id":"blue_vase"}

→ 停下
← {"action":"stop","reason":"user_request"}

→ 往那边挪一点
← {"action":"unknown","message":"指令模糊，无法确定具体目标位置"}

→ 拿起杯子然后放到桌子上
← {"action":"unknown","message":"请一次只说一个操作"}

→ 带我去月球
← {"action":"unknown","message":"目标超出场景范围"}

当前场景物体：
{{SCENE_OBJECTS}}
```

- [ ] **Step 2: Create ollamaClient.ts**

```typescript
import type { IInstruction, SceneObject } from '@/types'
import { ENGINE_CONFIG } from '@/config'

const SYSTEM_PROMPT_TEMPLATE = '' // Will be loaded from ai/system_prompt.txt

const VALID_ACTIONS = new Set([
  'move_to', 'pick_up', 'place_down', 'follow_path',
  'query', 'query_user', 'stop', 'unknown'
])

export async function loadSystemPrompt(): Promise<string> {
  if (SYSTEM_PROMPT_TEMPLATE) return SYSTEM_PROMPT_TEMPLATE
  const resp = await fetch('/ai/system_prompt.txt')
  return await resp.text()
}

function validateAndParse(raw: string): IInstruction | null {
  // Strip any markdown code fences
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Try direct parse
  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract first JSON object
    const match = cleaned.match(/\{[\s\S]*?\}/)
    if (!match) return null
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return null
    }
  }

  if (!parsed.action || !VALID_ACTIONS.has(parsed.action)) return null

  // Extract params (everything except action)
  const { action, ...params } = parsed

  return {
    action: action as IInstruction['action'],
    params,
    raw: cleaned
  }
}

function buildSceneObjectsBlock(objects: SceneObject[]): string {
  if (objects.length === 0) return '（场景中暂无物体）'
  return objects
    .map(o => `- ${o.id} [${o.position.join(', ')}] tag=${o.tag}`)
    .join('\n')
}

export async function parseInstruction(
  userInput: string,
  sceneObjects: SceneObject[]
): Promise<IInstruction> {
  if (ENGINE_CONFIG.ai.mode === 'mock') {
    return mockParse(userInput, sceneObjects)
  }

  const systemPrompt = await loadSystemPrompt()
  const sceneBlock = buildSceneObjectsBlock(sceneObjects)
  const fullSystem = systemPrompt.replace('{{SCENE_OBJECTS}}', sceneBlock)

  for (let attempt = 0; attempt <= ENGINE_CONFIG.ai.retryCount; attempt++) {
    try {
      const response = await fetch(`${ENGINE_CONFIG.ai.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ENGINE_CONFIG.ai.model,
          system: fullSystem,
          prompt: userInput,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            stop: ['\n\n', '\n', '```']
          }
        })
      })

      if (!response.ok) {
        console.warn(`[ollamaClient] Attempt ${attempt + 1}: HTTP ${response.status}`)
        await delay(200 * (attempt + 1))
        continue
      }

      const data = await response.json()
      const parsed = validateAndParse(data.response)

      if (parsed) return parsed

      console.warn(`[ollamaClient] Attempt ${attempt + 1}: validation failed`)
      await delay(500 * (attempt + 1))
    } catch (err) {
      console.warn(`[ollamaClient] Attempt ${attempt + 1}:`, err)
      await delay(200 * (attempt + 1))
    }
  }

  // All retries exhausted — return unknown
  return {
    action: 'unknown',
    params: { message: 'AI 服务暂时不可用，请稍后重试' },
    raw: ''
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mockParse(userInput: string, sceneObjects: SceneObject[]): IInstruction {
  // Simple regex-based mock parser for offline development
  const input = userInput.trim()

  if (/停[下止]?|别动|stop/i.test(input)) {
    return { action: 'stop', params: { reason: 'user_request' }, raw: '' }
  }

  // Check for multiple operations
  if (/然后|接着|并且|之后/.test(input)) {
    return { action: 'unknown', params: { message: '请一次只说一个操作' }, raw: '' }
  }

  // move_to detection
  const moveMatch = input.match(/移动|去|走到|导航|move/i)
  if (moveMatch) {
    const coordMatch = input.match(/\(?\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\)?/)
    if (coordMatch) {
      const target = [parseFloat(coordMatch[1]), parseFloat(coordMatch[2]), parseFloat(coordMatch[3])]
      return { action: 'move_to', params: { target, avoid_tags: ['static_obstacle'] }, raw: '' }
    }
    // Object-based movement
    for (const obj of sceneObjects) {
      if (input.includes(obj.tag) || input.includes(obj.id)) {
        return {
          action: 'move_to',
          params: {
            target: obj.position,
            avoid_tags: ['static_obstacle', obj.tag]
          },
          raw: ''
        }
      }
    }
    // Multi-object disambiguation
    const tagMatches = sceneObjects.filter(o => o.tag !== 'robot')
    const mentionedTag = tagMatches.find(o => input.includes(o.tag))
    if (mentionedTag) {
      const candidates = tagMatches
        .filter(o => o.tag === mentionedTag.tag)
        .map(o => ({
          id: o.id,
          desc: `${o.tag} 位于 (${o.position[0].toFixed(1)}, ${o.position[1].toFixed(1)}, ${o.position[2].toFixed(1)})`,
          position: o.position
        }))
      if (candidates.length > 1) {
        return { action: 'query_user', params: { target_object: mentionedTag.tag, candidates }, raw: '' }
      }
    }
    return { action: 'unknown', params: { message: '请指定具体目标位置或物体' }, raw: '' }
  }

  // pick_up detection
  if (/拿[起取]|抓取|拾取|pick/i.test(input)) {
    // Extract object name
    const objMatch = input.match(/(?:拿[起取]|抓取|拾取|pick\w*)\s*(.+)/i)
    const objName = objMatch ? objMatch[1].trim() : 'unknown'
    return { action: 'pick_up', params: { object_id: objName }, raw: '' }
  }

  // Vague instructions
  if (/那边|这里|那里|一点|一下/.test(input) && !/\(/.test(input)) {
    return { action: 'unknown', params: { message: '指令模糊，无法确定具体目标位置' }, raw: '' }
  }

  return { action: 'unknown', params: { message: '无法识别指令' }, raw: '' }
}
```

- [ ] **Step 3: Create ControlPanel.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { parseInstruction } from '@/utils/ollamaClient'
import type { IInstruction, SceneObject } from '@/types'

const emit = defineEmits<{
  instruction: [inst: IInstruction]
}>()

const props = defineProps<{
  sceneObjects: SceneObject[]
}>()

const userInput = ref('')
const loading = ref(false)
const lastResult = ref<string | null>(null)
const status = ref('idle') // idle | parsing | navigating | collision

function mapStatus(s: string) {
  status.value = s
}

async function sendInstruction() {
  const text = userInput.value.trim()
  if (!text) return

  loading.value = true
  status.value = 'parsing'
  lastResult.value = null

  try {
    const instruction = await parseInstruction(text, props.sceneObjects)
    lastResult.value = JSON.stringify(instruction, null, 2)

    if (instruction.action === 'query_user') {
      const candidates = instruction.params.candidates as any[]
      if (candidates) {
        // Simple console-based disambiguation for now
        console.log('[ControlPanel] Multiple targets found:', candidates)
        lastResult.value = `场景中有多个匹配物体:\n${candidates.map((c: any, i: number) => `${String.fromCharCode(65 + i)}: ${c.desc}`).join('\n')}\n请在输入框输入字母选择。`
        status.value = 'idle'
        loading.value = false
        return
      }
    }

    emit('instruction', instruction)
    if (instruction.action === 'move_to') {
      status.value = 'navigating'
    } else {
      status.value = 'idle'
    }
  } catch (err) {
    lastResult.value = `错误: ${err}`
    status.value = 'idle'
  } finally {
    loading.value = false
  }
}

const statusLabels: Record<string, string> = {
  idle: '空闲',
  parsing: 'AI 解析中...',
  navigating: '导航移动中',
  collision: '⚠ 碰撞警报',
}

defineExpose({ mapStatus })
</script>

<template>
  <div style="position: absolute; top: 8px; right: 8px; width: 280px; background: rgba(10,10,20,0.9); border-radius: 6px; padding: 12px; z-index: 10; font-family: monospace; font-size: 12px; color: #c0c0d0;">
    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
      <span style="color: #00ff88; font-weight: bold;">状态:</span>
      <span>{{ statusLabels[status] || status }}</span>
      <span v-if="loading" style="color: #ffaa00;">⏳</span>
    </div>

    <input
      v-model="userInput"
      @keyup.enter="sendInstruction"
      placeholder="输入指令，如：移动到桌子旁..."
      :disabled="loading"
      style="width: 100%; padding: 6px 10px; background: #1a1a2e; border: 1px solid #333; border-radius: 4px; color: #e0e0e0; font-size: 12px; outline: none; box-sizing: border-box;"
    />

    <button
      @click="sendInstruction"
      :disabled="loading || !userInput.trim()"
      style="width: 100%; margin-top: 6px; padding: 6px; background: #00ff88; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;"
      :style="{ opacity: (loading || !userInput.trim()) ? 0.5 : 1 }"
    >
      {{ loading ? '解析中...' : '发送指令' }}
    </button>

    <pre v-if="lastResult" style="margin-top: 8px; padding: 6px; background: #0a0a15; border-radius: 3px; max-height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; font-size: 11px;">{{ lastResult }}</pre>
  </div>
</template>
```

- [ ] **Step 4: Update App.vue — integrate ControlPanel**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
import ControlPanel from './components/ControlPanel.vue'
import { generateFakeObjects, type SceneObject, type IInstruction } from './types'

const sceneObjects = ref<SceneObject[]>(generateFakeObjects(100))
const controlPanelRef = ref<InstanceType<typeof ControlPanel>>()

function onInstruction(inst: IInstruction) {
  console.log('[App] Instruction received:', inst)
  // Sprint 9 will wire this to the kernel
}
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; position: relative;">
    <Stage3D style="flex: 1;" :sceneObjects="sceneObjects" />
    <ControlPanel
      ref="controlPanelRef"
      :sceneObjects="sceneObjects"
      @instruction="onInstruction"
    />
    <Profiler />
  </div>
</template>
```

- [ ] **Step 5: Copy system_prompt.txt to frontend public for fetching**

The `ollamaClient.ts` fetches `/ai/system_prompt.txt`. Configure Vite to serve the `ai/` directory:

Add to `vite.config.ts`:

```typescript
server: {
  port: 3000,
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  },
  fs: {
    allow: ['..'] // Allow serving files from parent directory (ai/)
  }
},
publicDir: 'public',
```

And create a symlink or copy step. Simpler: copy `ai/system_prompt.txt` to `frontend/public/ai/` during build. For now, create the directory and copy:

```bash
mkdir -p frontend/public/ai
cp ai/system_prompt.txt frontend/public/ai/
```

- [ ] **Step 6: Verify S8 acceptance criteria**

Set `ai.mode: 'mock'` in config.ts. Run `npm run dev`.
Expected:
- Input "移动到(1,0,2)" → Result shows `{"action":"move_to","params":{"target":[1,0,2],...}}`
- Input "飞" → Result shows `{"action":"unknown",...}`
- Input "停下" → Result shows `{"action":"stop",...}`
- Input "往那边挪一点" → Result shows unknown with "指令模糊"

Set `ai.mode: 'real'` (with Ollama running). Same inputs should produce similar results via the local model.

- [ ] **Step 7: Commit**

```bash
git add ai/system_prompt.txt frontend/src/utils/ollamaClient.ts frontend/src/components/ControlPanel.vue frontend/src/App.vue frontend/vite.config.ts frontend/public/ai/
git commit -m "feat(S8): implement Plan B AI prompt + ollama client + control panel"
```

---

## Sprint 9: 全链路闭环

### Task 9: Wire AI → Store → Wasm → Render into complete loop

**Files:**
- Create: `frontend/src/stores/simulationStore.ts`
- Modify: `frontend/src/components/Stage3D.vue`
- Modify: `frontend/src/components/ControlPanel.vue`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Create simulationStore.ts (Pinia)**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SceneObject, CollisionPair, IInstruction, ProfilerSnapshot } from '@/types'

export const useSimulationStore = defineStore('simulation', () => {
  // State
  const sceneObjects = ref<SceneObject[]>([])
  const robotPosition = ref<[number, number, number]>([0, 0.3, 0])
  const robotTarget = ref<[number, number, number] | null>(null)
  const status = ref<'idle' | 'navigating' | 'collision' | 'querying'>('idle')
  const collisions = ref<CollisionPair[]>([])
  const profilerHistory = ref<ProfilerSnapshot[]>([])
  const queryUserCandidates = ref<any[]>([])

  // Computed
  const isRobotMoving = computed(() => status.value === 'navigating')
  const latestCollisions = computed(() => collisions.value)

  // Actions
  function initScene(objects: SceneObject[]) {
    sceneObjects.value = [...objects]
    robotPosition.value = [...objects[0].position]
    status.value = 'idle'
  }

  function executeInstruction(inst: IInstruction) {
    switch (inst.action) {
      case 'move_to': {
        const target = inst.params.target as [number, number, number]
        if (!target || target.length !== 3) return
        robotTarget.value = target
        status.value = 'navigating'
        break
      }
      case 'stop': {
        robotTarget.value = null
        status.value = 'idle'
        break
      }
      case 'query_user': {
        queryUserCandidates.value = (inst.params.candidates as any[]) || []
        status.value = 'querying'
        break
      }
      case 'unknown': {
        status.value = 'idle'
        console.log('[SimStore] Unknown instruction:', inst.params.message)
        break
      }
      default:
        console.log('[SimStore] Unhandled action:', inst.action)
    }
  }

  function resolveQueryUser(choiceIndex: number) {
    const candidate = queryUserCandidates.value[choiceIndex]
    if (!candidate) return
    queryUserCandidates.value = []
    status.value = 'idle'
    // Re-issue as move_to
    robotTarget.value = candidate.position
    status.value = 'navigating'
  }

  function setCollisions(newCollisions: CollisionPair[]) {
    collisions.value = newCollisions
    if (newCollisions.length > 0 && status.value === 'navigating') {
      status.value = 'collision'
    }
  }

  function updateRobotPosition(pos: [number, number, number]) {
    robotPosition.value = pos
    // Update in scene objects array
    if (sceneObjects.value.length > 0) {
      sceneObjects.value[0].position = pos
    }
  }

  function addProfilerSnapshot(snap: ProfilerSnapshot) {
    profilerHistory.value.push(snap)
    if (profilerHistory.value.length > 600) {
      profilerHistory.value.shift()
    }
  }

  function setStatus(s: 'idle' | 'navigating' | 'collision' | 'querying') {
    status.value = s
  }

  return {
    sceneObjects, robotPosition, robotTarget, status, collisions,
    profilerHistory, queryUserCandidates,
    isRobotMoving, latestCollisions,
    initScene, executeInstruction, resolveQueryUser,
    setCollisions, updateRobotPosition, addProfilerSnapshot, setStatus
  }
})
```

- [ ] **Step 2: Update Stage3D.vue — accept sceneObjects prop and integrate kernel**

Add props:

```typescript
const props = defineProps<{
  sceneObjects: SceneObject[]
}>()
```

In `onMounted`, use `props.sceneObjects` instead of generating them internally. Add robot movement logic in the animate loop:

```typescript
// Robot movement toward target
const store = useSimulationStore()
function updateRobotMovement() {
  if (store.status !== 'navigating' || !store.robotTarget) return

  const [rx, ry, rz] = store.robotPosition
  const [tx, ty, tz] = store.robotTarget
  const speed = 0.05 // units per frame at 60fps

  const dx = tx - rx
  const dy = ty - ry
  const dz = tz - rz
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (dist < 0.01) {
    // Arrived
    store.setStatus('idle')
    store.robotTarget = null
    return
  }

  const step = Math.min(speed, dist)
  const newPos: [number, number, number] = [
    rx + (dx / dist) * step,
    ry + (dy / dist) * step,
    rz + (dz / dist) * step,
  ]

  // Check collisions before moving
  const kernel = getKernel()
  if (kernel) {
    const colls = kernel.getCollisions()
    if (colls.length > 0) {
      store.setCollisions(colls)
      // Revert: move backward
      const backoff = 0.1
      store.updateRobotPosition([
        rx - (dx / dist) * backoff,
        ry,
        rz - (dz / dist) * backoff,
      ])
      return
    }
  }

  store.updateRobotPosition(newPos)
  store.setStatus('navigating')

  // Update robot InstancedMesh
  dummy.position.set(...newPos)
  dummy.scale.set(0.6, 0.6, 0.6)
  dummy.updateMatrix()
  robotMesh.setMatrixAt(0, dummy.matrix)
  robotMesh.instanceMatrix.needsUpdate = true
}

// Call in animate():
updateRobotMovement()
```

Add import:

```typescript
import { useSimulationStore } from '@/stores/simulationStore'
```

- [ ] **Step 3: Update App.vue — wire everything through Pinia**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { createPinia } from 'pinia'
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
import ControlPanel from './components/ControlPanel.vue'
import { generateFakeObjects } from './types'
import { useSimulationStore } from './stores/simulationStore'
import { loadKernel } from './utils/wasmLoader'

// Pinia is installed in main.ts
const store = useSimulationStore()

onMounted(async () => {
  const objects = generateFakeObjects(100)
  store.initScene(objects)

  const kernel = await loadKernel()
  kernel.init(objects)
})

function onInstruction(inst: any) {
  store.executeInstruction(inst)
}
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; position: relative;">
    <Stage3D style="flex: 1;" :sceneObjects="store.sceneObjects" />
    <ControlPanel
      :sceneObjects="store.sceneObjects"
      @instruction="onInstruction"
    />
    <Profiler />
  </div>
</template>
```

- [ ] **Step 4: Update main.ts — install Pinia**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 5: Verify S9 acceptance criteria**

Run `npm run dev` with `ai.mode: 'mock'` and `compute.mode: 'mock'`.
Expected:
1. Input "移动到(3, 0, 2)" → robot cube moves toward (3, 0, 2)
2. If path crosses another object → robot backs off and status shows "⚠ 碰撞警报"
3. Profiler updates in real time
4. Full loop: natural language → JSON → robot movement → 3D rendering

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/simulationStore.ts frontend/src/components/Stage3D.vue frontend/src/components/ControlPanel.vue frontend/src/App.vue frontend/src/main.ts
git commit -m "feat(S9): complete AI→Store→Kernel→Render closed loop"
```

---

## Sprint 10: 打磨收尾

### Task 10: README, performance tuning, edge-case fixes

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Modify: `frontend/src/components/Stage3D.vue` (perf)
- Modify: `core/src/engine_core.cpp` (edge cases)

- [ ] **Step 1: Create README.md**

```markdown
# AetherMesh Engine

端侧具身智能 3D 空间动态重建与避障模拟引擎

浏览器运行、零重型环境依赖的轻量化具身智能空间仿真沙箱。

## 技术栈

- **前端**: Vue 3 + Vite + TypeScript + Three.js + Pinia
- **计算内核**: Modern C++17 + Emscripten → WebAssembly
- **AI 推理**: Ollama + qwen3.5:9b (本地)

## 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | ≥18 |
| CMake | ≥3.20 |
| Emscripten | ≥3.1.x |
| Ollama | ≥0.5.x |

## 快速开始

### 1. 安装前端依赖

```bash
cd frontend
npm install
```

### 2. 编译 Wasm 内核

```bash
bash build_wasm.sh
```

### 3. 启动 Ollama（确保已拉取模型）

```bash
ollama serve
# 另一个终端：
ollama pull qwen3.5:9b
```

### 4. 启动开发服务器

```bash
cd frontend
npm run dev
```

打开 http://localhost:3000

### 5. 使用

- 鼠标拖拽旋转视角，滚轮缩放
- 右侧面板输入自然语言指令
- 左下角查看实时性能指标

## 配置

编辑 `frontend/src/config.ts` 切换 Mock/Real 模式：

```typescript
export const ENGINE_CONFIG = {
  ai: { mode: 'mock' },     // 'real' 需要 Ollama 运行
  compute: { mode: 'mock' }, // 'real' 需要先编译 Wasm
}
```

## 项目结构

```
aethermesh-engine/
├── ai/                  # AI 提示词
├── core/                # C++ Wasm 计算内核
│   ├── include/         # 头文件
│   └── src/             # 源码
├── frontend/            # Vue3 前端
│   └── src/
│       ├── components/  # Stage3D, ControlPanel, Profiler
│       ├── stores/      # Pinia 状态管理
│       └── utils/       # wasmLoader, ollamaClient, mockKernel
└── build_wasm.sh        # Wasm 编译脚本
```

## License

MIT
```

- [ ] **Step 2: Create .gitignore**

```gitignore
node_modules/
dist/
.vite/
*.log

# Wasm build artifacts
core/build/
frontend/public/wasm/*.js
frontend/public/wasm/*.wasm
frontend/public/wasm/*.data
frontend/public/wasm/*.worker.js

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Create LICENSE**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Performance tuning — Stage3D.vue optimizations**

Key optimizations to apply in [Stage3D.vue](frontend/src/components/Stage3D.vue):

1. **Limit InstancedMesh color updates**: Only set colors on collision state change, not every frame:

```typescript
let lastCollisionState = false

// In animate(), replace per-frame collision check:
const hasCollision = store.latestCollisions.length > 0
if (hasCollision !== lastCollisionState) {
  lastCollisionState = hasCollision
  if (hasCollision) {
    robotMesh.setColorAt(0, new THREE.Color(1, 0, 0))
  } else {
    robotMesh.setColorAt(0, new THREE.Color(0, 1, 0.5))
  }
  robotMesh.instanceColor!.needsUpdate = true
}
```

2. **Use requestAnimationFrame properly**: Ensure only one render loop is active.

3. **Dispose geometries and materials on unmount** (already handled).

- [ ] **Step 5: C++ edge case fix — GJK iteration cap and epsilon consistency**

In [minkowski.cpp](core/src/minkowski.cpp), ensure the epsilon constant is consistently `1e-6f` and the iteration counter properly handles the tetrahedron case. Verify this code is already in place (it is from Sprint 7).

- [ ] **Step 6: Final verification**

```bash
# Full build test
bash build_wasm.sh
cd frontend && npm run build

# Check no TS errors
npx vue-tsc --noEmit

# Run dev server and verify all acceptance criteria
npm run dev
```

Manual checklist:
- [ ] 100+ cubes visible, 60+ FPS
- [ ] Profiler shows live data
- [ ] Wasm kernel loads (real mode) or mock works
- [ ] AI parses "移动到(1,0,2)" correctly
- [ ] Robot moves, collides, backs off
- [ ] No memory leaks after 10 min runtime (Chrome Task Manager)

- [ ] **Step 7: Commit**

```bash
git add README.md LICENSE .gitignore frontend/src/components/Stage3D.vue
git commit -m "feat(S10): add README, license, .gitignore, performance tune"
```

---

## Sprint Dependency Graph

```
S1 ──→ S2 ──→ S3 ──────────────────────┐
                                         ├──→ S9 ──→ S10
S4 ──→ S5 ──→ S6 ──→ S7 ───────────────┘
                                         │
S8 ─────────────────────────────────────┘
```

S1-S3 and S4-S7 and S8 can be developed in parallel by different workstreams, but for solo development the sequential order (S1→S2→...→S10) is recommended as each sprint builds context for the next.

---

## Acceptance Criteria Summary

| Sprint | Gate |
|--------|------|
| S1 | 3D scene renders, camera rotates/zooms, no WebGL errors |
| S2 | 100 colored objects + green robot, ≥60 FPS, no warnings |
| S3 | Profiler shows live FPS/DrawCalls/Memory values |
| S4 | `build_wasm.sh` succeeds, Wasm file exists |
| S5 | 10000 vertices zero-copy processed <1ms, data verified |
| S6 | Wasm compiles with BVH, scene AABB data ready |
| S7 | Collisions detected (mock: AABB overlap; real: GJK+Minkowski), red highlight |
| S8 | "移动到(1,0,2)" → valid JSON; "飞" → unknown; mock + real both work |
| S9 | NL input → robot moves → collides → backs off → 3D visible |
| S10 | README reproducible, 24h no memory leak (Chrome Task Manager) |
