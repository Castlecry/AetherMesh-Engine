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
const status = ref('idle')

const statusLabels: Record<string, string> = {
  idle: '空闲',
  parsing: 'AI 解析中...',
  navigating: '导航移动中',
  collision: '⚠ 碰撞警报',
}

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
