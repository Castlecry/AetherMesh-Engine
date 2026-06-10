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
