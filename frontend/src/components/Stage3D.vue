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
