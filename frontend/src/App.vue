<script setup lang="ts">
import { onMounted } from 'vue'
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
import ControlPanel from './components/ControlPanel.vue'
import { generateFakeObjects } from './types'
import { useSimulationStore } from './stores/simulationStore'
import { loadKernel } from './utils/wasmLoader'

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
