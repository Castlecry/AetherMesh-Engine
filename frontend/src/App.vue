<script setup lang="ts">
import { ref } from 'vue'
import Stage3D from './components/Stage3D.vue'
import Profiler from './components/Profiler.vue'
import ControlPanel from './components/ControlPanel.vue'
import { generateFakeObjects, type SceneObject, type IInstruction } from './types'

const sceneObjects = ref<SceneObject[]>(generateFakeObjects(100))

function onInstruction(inst: IInstruction) {
  console.log('[App] Instruction received:', inst)
}
</script>

<template>
  <div style="display: flex; width: 100%; height: 100%; position: relative;">
    <Stage3D style="flex: 1;" />
    <ControlPanel
      :sceneObjects="sceneObjects"
      @instruction="onInstruction"
    />
    <Profiler />
  </div>
</template>
