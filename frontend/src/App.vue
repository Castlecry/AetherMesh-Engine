<script setup lang="ts">
import { onMounted } from 'vue'
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
import ControlPanel from './components/ControlPanel.vue'
import { generatePresetScene, getScenePresets, deoverlapObjects } from './types'
import type { ScenePreset, SceneObject } from './types'
import { useSimulationStore } from './stores/simulationStore'
import { loadKernel, getKernel } from './utils/wasmLoader'

const store = useSimulationStore()

// Default preset scene — deterministic, same layout every time
const CURRENT_PRESET: ScenePreset = 'default'
let objects = deoverlapObjects(generatePresetScene(CURRENT_PRESET))
store.initScene(objects)

console.log(`[App] Scene preset: ${CURRENT_PRESET} — ${objects.length} objects`)
console.log(`[App] Available presets:`, getScenePresets().map(p => `${p.key} (${p.count} objs)`).join(', '))

// Async kernel init
onMounted(async () => {
  const kernel = await loadKernel()
  kernel.init(objects)
})

function onInstruction(inst: any) {
  store.executeInstruction(inst)
}

function onUpdateScene(newObjects: SceneObject[]) {
  objects = deoverlapObjects(newObjects)
  store.initScene(objects)
  const kernel = getKernel()
  if (kernel) kernel.init(objects)
}
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; position: relative;">
    <Stage3D style="flex: 1;" :sceneObjects="store.sceneObjects" />
    <ControlPanel
      :sceneObjects="store.sceneObjects"
      @instruction="onInstruction"
      @updateScene="onUpdateScene"
    />
    <Profiler />
  </div>
</template>
