<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import type { SceneObject } from '@/types'
import { useSimulationStore } from '@/stores/simulationStore'
import { getKernel } from '@/utils/wasmLoader'

const props = defineProps<{
  sceneObjects: SceneObject[]
}>()

const container = ref<HTMLDivElement>()
const store = useSimulationStore()
let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let animationId: number
let boxMesh: THREE.InstancedMesh
let sphereMesh: THREE.InstancedMesh
let robotMesh: THREE.InstancedMesh
let frameCount = 0
let lastFpsTime = performance.now()

const dummy = new THREE.Object3D()

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
  const boxObjects = props.sceneObjects.filter(o => o.id !== 'obj_0' && o.meshType === 'box')
  const sphereObjects = props.sceneObjects.filter(o => o.id !== 'obj_0' && o.meshType === 'sphere')

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
  if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true
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
  if (sphereMesh.instanceColor) sphereMesh.instanceColor.needsUpdate = true
  scene.add(sphereMesh)

  // Robot instanced mesh (single instance, bright green box)
  const robotGeo = new THREE.BoxGeometry(1, 1, 1)
  const robotMat = new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: 0x004400, emissiveIntensity: 0.5 })
  robotMesh = new THREE.InstancedMesh(robotGeo, robotMat, 1)
  robotMesh.castShadow = true
  const robot = props.sceneObjects[0]
  dummy.position.set(...robot.position)
  dummy.scale.set(robot.halfExtents[0] * 2, robot.halfExtents[1] * 2, robot.halfExtents[2] * 2)
  dummy.updateMatrix()
  robotMesh.setMatrixAt(0, dummy.matrix)
  robotMesh.setColorAt(0, new THREE.Color(0, 1, 0.5))
  robotMesh.instanceMatrix.needsUpdate = true
  if (robotMesh.instanceColor) robotMesh.instanceColor.needsUpdate = true
  scene.add(robotMesh)

  setupOrbitControls()

  function animate() {
    animationId = requestAnimationFrame(animate)
    frameCount++

    // Update FPS counter every 500ms
    const now = performance.now()
    if (now - lastFpsTime >= 500) {
      const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000))
      if ((window as any).__profilerUpdate) {
        (window as any).__profilerUpdate(fps, renderer.info.render.calls, 0)
      }
      frameCount = 0
      lastFpsTime = now
    }

    // Robot movement toward target (S9)
    updateRobotMovement()

    renderer.render(scene, camera)
  }

  function updateRobotMovement() {
    if (store.status !== 'navigating' || !store.robotTarget) return

    const [rx, ry, rz] = store.robotPosition
    const [tx, ty, tz] = store.robotTarget
    const speed = 0.05

    const dx = tx - rx
    const dy = ty - ry
    const dz = tz - rz
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist < 0.01) {
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

<template>
  <div ref="container" style="width: 100%; height: 100%;" />
</template>
