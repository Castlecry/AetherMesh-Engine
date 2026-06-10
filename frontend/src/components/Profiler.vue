<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement>()
const fps = ref(0)
const drawCalls = ref(0)
const memoryMB = ref(0)
const bvhTraversalMs = ref(0)

let history: number[] = Array(120).fill(0)
let frameIdx = 0

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

// Expose globally so Stage3D can call it without prop drilling
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
