<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import type { SceneObject } from '@/types'
import { useSimulationStore } from '@/stores/simulationStore'
import { getKernel } from '@/utils/wasmLoader'

const props = defineProps<{ sceneObjects: SceneObject[] }>()
const container = ref<HTMLDivElement>()
const store = useSimulationStore()

let renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera
let animationId: number, frameCount = 0, lastFpsTime = performance.now()

// Instanced meshes
let boxMesh: THREE.InstancedMesh, sphereMesh: THREE.InstancedMesh, robotMesh: THREE.InstancedMesh
let boxObjectIds: string[] = [], sphereObjectIds: string[] = [], robotObjectId = ''
let allObjectsMap = new Map<string, { mesh: THREE.InstancedMesh; instanceId: number }>()

// Highlight & path
let highlightBox: THREE.Mesh
let pathLine: THREE.Line | null = null
let pathDots: THREE.Mesh[] = []

// Raycaster
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const dummy = new THREE.Object3D()

// ---- Scene build ----

function rebuildScene() {
  if (!container.value) return
  boxMesh?.dispose(); sphereMesh?.dispose(); robotMesh?.dispose()
  scene.remove(boxMesh); scene.remove(sphereMesh); scene.remove(robotMesh)
  allObjectsMap.clear(); boxObjectIds = []; sphereObjectIds = []
  clearPathLine()

  const objs = props.sceneObjects
  if (objs.length === 0) return

  const boxObjects = objs.filter(o => o.id !== objs[0]?.id && o.meshType === 'box')
  const sphereObjects = objs.filter(o => o.id !== objs[0]?.id && o.meshType === 'sphere')

  if (boxObjects.length > 0) {
    const g = new THREE.BoxGeometry(1, 1, 1)
    boxMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.5 }), boxObjects.length)
    boxMesh.castShadow = boxMesh.receiveShadow = true
    boxObjects.forEach((obj, i) => {
      dummy.position.set(...obj.position)
      dummy.scale.set(obj.halfExtents[0] * 2, obj.halfExtents[1] * 2, obj.halfExtents[2] * 2)
      dummy.updateMatrix(); boxMesh.setMatrixAt(i, dummy.matrix)
      boxMesh.setColorAt(i, new THREE.Color(...obj.color!))
      boxObjectIds[i] = obj.id; allObjectsMap.set(obj.id, { mesh: boxMesh, instanceId: i })
    })
    boxMesh.instanceMatrix.needsUpdate = true
    if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true
    scene.add(boxMesh)
  }

  if (sphereObjects.length > 0) {
    const g = new THREE.SphereGeometry(0.5, 16, 16)
    sphereMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.4 }), sphereObjects.length)
    sphereMesh.castShadow = sphereMesh.receiveShadow = true
    sphereObjects.forEach((obj, i) => {
      dummy.position.set(...obj.position)
      const s = obj.halfExtents[0] * 2; dummy.scale.set(s, s, s)
      dummy.updateMatrix(); sphereMesh.setMatrixAt(i, dummy.matrix)
      sphereMesh.setColorAt(i, new THREE.Color(...obj.color!))
      sphereObjectIds[i] = obj.id; allObjectsMap.set(obj.id, { mesh: sphereMesh, instanceId: i })
    })
    sphereMesh.instanceMatrix.needsUpdate = true
    if (sphereMesh.instanceColor) sphereMesh.instanceColor.needsUpdate = true
    scene.add(sphereMesh)
  }

  const robot = objs[0]
  if (robot) {
    robotObjectId = robot.id
    const g = new THREE.BoxGeometry(1, 1, 1)
    robotMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: 0x004400, emissiveIntensity: 0.5 }), 1)
    robotMesh.castShadow = true
    dummy.position.set(...robot.position)
    dummy.scale.set(robot.halfExtents[0] * 2, robot.halfExtents[1] * 2, robot.halfExtents[2] * 2)
    dummy.updateMatrix(); robotMesh.setMatrixAt(0, dummy.matrix)
    robotMesh.setColorAt(0, new THREE.Color(0, 1, 0.5))
    robotMesh.instanceMatrix.needsUpdate = true
    if (robotMesh.instanceColor) robotMesh.instanceColor.needsUpdate = true
    scene.add(robotMesh)
    allObjectsMap.set(robot.id, { mesh: robotMesh, instanceId: 0 })
  }
}

// ---- Path Line ----

function clearPathLine() {
  pathLine && scene.remove(pathLine); pathLine = null
  pathDots.forEach(d => { scene.remove(d); d.geometry.dispose() }); pathDots = []
}

function updatePathLine() {
  clearPathLine()
  if (store.waypoints.length === 0) return

  const pts: THREE.Vector3[] = [
    new THREE.Vector3(...store.robotPosition),
    ...store.waypoints.map(w => new THREE.Vector3(...w))
  ]

  if (pts.length < 2) return

  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineBasicMaterial({ color: 0x00aaff, linewidth: 1, transparent: true, opacity: 0.7 })
  pathLine = new THREE.Line(geo, mat)
  scene.add(pathLine)

  // Dots at waypoints
  store.waypoints.forEach((wp, i) => {
    const dotGeo = new THREE.SphereGeometry(0.1, 8, 8)
    const color = i < store.currentWaypointIndex ? 0x00ff88 : i === store.currentWaypointIndex ? 0xffaa00 : 0x666666
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color }))
    dot.position.set(...wp)
    scene.add(dot); pathDots.push(dot)
  })
}

// ---- Update per-frame ----

function lerpPos(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function updateRobotMovement() {
  if (store.status !== 'navigating' || !store.robotTarget) return

  const pos = store.robotPosition
  const tgt = store.robotTarget
  const speed = 0.06
  const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1], dz = tgt[2] - pos[2]
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

  if (dist < 0.08) {
    store.advanceWaypoint()
    updatePathLine()
    return
  }

  const step = Math.min(speed, dist)
  const newPos: [number, number, number] = [
    pos[0] + (dx / dist) * step,
    pos[1] + (dy / dist) * step,
    pos[2] + (dz / dist) * step,
  ]

  // Simple collision check
  const kernel = getKernel()
  if (kernel) {
    const colls = kernel.getCollisions()
    if (colls.length > 0) {
      store.setCollisions(colls)
      // Try to step sideways
      const sideX = -(dz / dist) * 0.15
      const sideZ = (dx / dist) * 0.15
      store.updateRobotPosition([pos[0] + sideX, pos[1], pos[2] + sideZ])
      return
    }
  }

  store.updateRobotPosition(newPos)

  if (robotMesh) {
    dummy.position.set(...newPos)
    dummy.scale.set(0.6, 0.6, 0.6)
    dummy.updateMatrix()
    robotMesh.setMatrixAt(0, dummy.matrix)
    robotMesh.instanceMatrix.needsUpdate = true
  }

  updatePathLine()
}

function updateHighlight() {
  const selId = store.selectedObjectId
  if (!selId) { highlightBox.visible = false; return }
  const obj = props.sceneObjects.find(o => o.id === selId)
  if (!obj) { highlightBox.visible = false; return }
  highlightBox.visible = true
  highlightBox.position.set(...obj.position)
  highlightBox.scale.set(
    obj.halfExtents[0] * 2 + 0.15,
    obj.halfExtents[1] * 2 + 0.15,
    obj.halfExtents[2] * 2 + 0.15
  )
}

// ---- Click handling ----

function getIntersections(event: MouseEvent) {
  if (!container.value) return { objectId: null as string | null, groundPoint: null as THREE.Vector3 | null }
  const rect = container.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)

  const meshes: THREE.InstancedMesh[] = []
  if (boxMesh) meshes.push(boxMesh)
  if (sphereMesh) meshes.push(sphereMesh)
  if (robotMesh) meshes.push(robotMesh)

  const intersects = raycaster.intersectObjects(meshes)
  let objectId: string | null = null
  if (intersects.length > 0) {
    const hit = intersects[0], mesh = hit.object as THREE.InstancedMesh, instId = hit.instanceId!
    if (mesh === boxMesh && instId < boxObjectIds.length) objectId = boxObjectIds[instId]
    else if (mesh === sphereMesh && instId < sphereObjectIds.length) objectId = sphereObjectIds[instId]
    else if (mesh === robotMesh) objectId = robotObjectId
  }

  const groundPoint = new THREE.Vector3()
  const hitGround = raycaster.ray.intersectPlane(groundPlane, groundPoint)
  return { objectId, groundPoint: hitGround ? groundPoint : null }
}

function onClick(event: MouseEvent) {
  if ((event.target as HTMLElement)?.closest?.('[class*="panel"]')) return
  const { objectId, groundPoint } = getIntersections(event)
  if (objectId) { store.selectObject(objectId) }
  else if (groundPoint) {
    store.moveSelectedTo([groundPoint.x, 0, groundPoint.z])
  }
}

function onRightClick(event: MouseEvent) {
  event.preventDefault()
  store.selectObject(null)
}

// ---- Watch ----

watch(() => props.sceneObjects, () => rebuildScene(), { deep: true })
watch(() => store.waypoints, () => updatePathLine())

// ---- Lifecycle ----

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
  camera.position.set(10, 12, 18)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0x404060, 1.5))
  const dl = new THREE.DirectionalLight(0xffffff, 2)
  dl.position.set(10, 20, 5); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048)
  scene.add(dl)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.8 })
  )
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true
  scene.add(ground)
  scene.add(new THREE.GridHelper(20, 20, 0x444466, 0x222244))

  const hlGeo = new THREE.BoxGeometry(1, 1, 1)
  highlightBox = new THREE.Mesh(new THREE.EdgesGeometry(hlGeo), new THREE.MeshBasicMaterial({ color: 0x00ff88 }))
  highlightBox.visible = false
  scene.add(highlightBox)

  rebuildScene()
  container.value.addEventListener('click', onClick)
  container.value.addEventListener('contextmenu', onRightClick)
  setupOrbitControls()

  function animate() {
    animationId = requestAnimationFrame(animate)
    frameCount++
    const now = performance.now()
    if (now - lastFpsTime >= 500) {
      const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000))
      if ((window as any).__profilerUpdate) {
        (window as any).__profilerUpdate(fps, renderer.info.render.calls, 0)
      }
      frameCount = 0; lastFpsTime = now
    }
    updateRobotMovement()
    updateHighlight()
    renderer.render(scene, camera)
  }
  animate()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  ;[boxMesh, sphereMesh, robotMesh].forEach(m => m?.dispose())
  highlightBox?.geometry?.dispose(); (highlightBox?.material as THREE.Material)?.dispose()
  clearPathLine()
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
  let isDragging = false, dragMoved = false, prevMouse = { x: 0, y: 0 }
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position.clone().sub(new THREE.Vector3(0, 1, 0)))

  container.value!.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) { isDragging = true; dragMoved = false; prevMouse = { x: e.clientX, y: e.clientY } }
  })
  window.addEventListener('mouseup', () => {
    if (dragMoved) {
      const stopClick = (ev: Event) => {
        ev.stopPropagation(); ev.preventDefault()
        container.value!.removeEventListener('click', stopClick, true)
      }
      container.value!.addEventListener('click', stopClick, true)
    }
    isDragging = false; dragMoved = false
  })
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    const dx = e.clientX - prevMouse.x, dy = e.clientY - prevMouse.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true
    spherical.theta -= dx * 0.005; spherical.phi -= dy * 0.005
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.5, spherical.phi))
    const tgt = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(tgt)
    camera.lookAt(tgt)
    prevMouse = { x: e.clientX, y: e.clientY }
  })
  container.value!.addEventListener('wheel', (e) => {
    spherical.radius += e.deltaY * 0.02
    spherical.radius = Math.max(3, Math.min(40, spherical.radius))
    const tgt = new THREE.Vector3(0, 1, 0)
    camera.position.setFromSpherical(spherical).add(tgt)
    camera.lookAt(tgt)
  })
}
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%; cursor: pointer;" />
</template>
