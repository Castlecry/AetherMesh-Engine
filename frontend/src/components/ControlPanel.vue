<script setup lang="ts">
import { ref, computed } from 'vue'
import { parseInstruction } from '@/utils/ollamaClient'
import { useSimulationStore } from '@/stores/simulationStore'
import type { IInstruction, SceneObject } from '@/types'

const emit = defineEmits<{
  instruction: [inst: IInstruction]
  updateScene: [objects: SceneObject[]]
}>()

const props = defineProps<{
  sceneObjects: SceneObject[]
}>()

const store = useSimulationStore()
const userInput = ref('')
const sceneDesc = ref('')
const loading = ref(false)
const genLoading = ref(false)
const lastResult = ref<string | null>(null)
const showObjects = ref(false)

const statusLabels: Record<string, string> = {
  idle: '空闲',
  parsing: 'AI 解析中...',
  navigating: '移动中...',
  collision: '⚠ 碰撞',
  querying: '🔍 请选择',
}

const pathStatusLabels: Record<string, string> = {
  idle: '',
  planning: '📐 规划路径中',
  moving: '🚶 沿路径移动',
  blocked: '⚠ 路径受阻',
  arrived: '✅ 已到达',
  unreachable: '❌ 目标不可达',
}

const objectsByTag = computed(() => {
  const map: Record<string, SceneObject[]> = {}
  for (const obj of props.sceneObjects) {
    if (!map[obj.tag]) map[obj.tag] = []
    map[obj.tag].push(obj)
  }
  return map
})

const selObj = computed(() => store.selectedObject)

// ---- Send text instruction ----
async function sendInstruction() {
  const text = userInput.value.trim()
  if (!text) return

  loading.value = true
  lastResult.value = null

  try {
    const instruction = await parseInstruction(text, props.sceneObjects)

    if (instruction.action === 'query_user') {
      const candidates = instruction.params.candidates as any[]
      if (candidates) {
        lastResult.value = `🔍 多个匹配:\n${candidates.map((c: any, i: number) => `${String.fromCharCode(65 + i)}: ${c.desc}`).join('\n')}`
        loading.value = false
        return
      }
    }

    if (instruction.action === 'unknown') {
      lastResult.value = `❌ ${instruction.params.message}`
      loading.value = false
      return
    }

    emit('instruction', instruction)
    lastResult.value = `✅ ${instruction.action}`

  } catch (err) {
    lastResult.value = `⚠ 网络错误: ${err}`
  } finally {
    loading.value = false
  }
}

function quickStop() {
  userInput.value = '停'
  sendInstruction()
}

// ---- Natural language scene generation ----
async function generateScene() {
  const desc = sceneDesc.value.trim()
  if (!desc) return

  genLoading.value = true
  lastResult.value = null

  try {
    const resp = await fetch('http://localhost:3001/api/generate-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc })
    })

    const data = await resp.json()

    if (!resp.ok) {
      lastResult.value = `❌ ${data.error || `HTTP ${resp.status}`}`
      return
    }

    if (data.objects && data.objects.length > 0) {
      emit('updateScene', data.objects)
      lastResult.value = `✅ 场景已生成: ${data.objects.length} 个物体`
      sceneDesc.value = ''
    } else {
      lastResult.value = '❌ AI 返回的场景为空，请尝试更具体的描述'
    }
  } catch (err: any) {
    lastResult.value = `⚠ 后端连接失败: ${err.message ?? err}`
  } finally {
    genLoading.value = false
  }
}

defineExpose({})
</script>

<template>
  <div class="panel">
    <!-- ====== Status bar ====== -->
    <div class="status-bar">
      <span class="status-dot" :class="store.status" />
      <span class="status-text">{{ statusLabels[store.status] || store.status }}</span>
      <span v-if="loading" class="spinner">⏳</span>
      <span v-if="store.pathStatus !== 'idle'" class="path-status-badge" :class="store.pathStatus">
        {{ pathStatusLabels[store.pathStatus] || store.pathStatus }}
        <span v-if="store.waypoints.length > 0">({{ store.currentWaypointIndex + 1 }}/{{ store.waypoints.length }})</span>
      </span>
      <span class="obj-count">{{ sceneObjects.length }} 物体</span>
      <span class="obj-count" style="margin-left: 4px;">| 相机: 拖拽旋转/滚轮缩放</span>
    </div>

    <!-- ====== Selected object ====== -->
    <div v-if="selObj" class="selected-card">
      <div class="selected-header">
        <span>🎯 <b>{{ selObj.id }}</b></span>
        <span class="selected-tag">{{ selObj.tag }}</span>
        <span @click="store.selectObject(null)" class="btn-close" title="取消">✕</span>
      </div>
      <div class="selected-pos">
        位置: ({{ selObj.position.map(v => v.toFixed(1)).join(', ') }})
        <span style="color:#888;"> | {{ selObj.meshType === 'box' ? '📦' : '🔵' }} {{ selObj.meshType }}</span>
      </div>
      <div class="selected-hint">点击地面 → 机器人移向该点 | 右键取消选中</div>
    </div>

    <!-- ====== No selection hint ====== -->
    <div v-else class="hint-bar">
      💡 点击物体可选中查看 · 点击地面机器人移动 · 拖拽旋转视角 · 右键取消
    </div>

    <!-- ====== Scene Generation ====== -->
    <div class="section">
      <div class="section-title">🎨 自然语言生成场景</div>
      <div class="input-row">
        <input
          v-model="sceneDesc"
          @keyup.enter="generateScene"
          class="input"
          placeholder="描述你想要的场景，如: 一个客厅，有沙发、茶几和电视柜..."
          :disabled="genLoading"
        />
        <button
          @click="generateScene"
          :disabled="genLoading || !sceneDesc.trim()"
          class="btn btn-purple"
        >
          {{ genLoading ? '⏳' : '生成' }}
        </button>
      </div>
    </div>

    <!-- ====== Instruction Input ====== -->
    <div class="section">
      <div class="section-title">📝 指令输入</div>
      <textarea
        v-model="userInput"
        @keyup.enter.exact.prevent="sendInstruction"
        class="input input-textarea"
        rows="3"
        :placeholder="selObj ? `让机器人移动到 ${selObj.id} 旁边...` : '指挥机器人，如: 移动到 (3, 0, 2) / 绕过障碍物去红箱子旁'"
        :disabled="loading"
      />
      <div class="btn-row">
        <button
          @click="sendInstruction"
          :disabled="loading || !userInput.trim()"
          class="btn btn-green"
          style="flex:1;"
        >
          {{ loading ? 'AI 解析中...' : '发送指令' }}
        </button>
        <button
          v-if="store.status === 'navigating'"
          @click="quickStop"
          class="btn btn-red"
        >
          ⏹ 停止
        </button>
      </div>
    </div>

    <!-- ====== Result ====== -->
    <div v-if="lastResult" class="result-box" :class="{ error: lastResult.startsWith('❌') || lastResult.startsWith('⚠') }">
      {{ lastResult }}
    </div>

    <!-- ====== Object list ====== -->
    <div class="section">
      <div @click="showObjects = !showObjects" class="section-title toggle">
        {{ showObjects ? '▲' : '▼' }} 场景物体列表
      </div>
      <div v-if="showObjects" class="obj-list">
        <div v-for="(objs, tag) in objectsByTag" :key="tag" class="tag-group">
          <div class="tag-name">{{ tag }} <span class="tag-count">({{ objs.length }})</span></div>
          <div
            v-for="obj in objs.slice(0, 8)"
            :key="obj.id"
            @click="store.selectObject(obj.id)"
            class="obj-row"
            :class="{ selected: store.selectedObjectId === obj.id }"
          >
            <span class="obj-id">{{ obj.id }}</span>
            <span class="obj-coord">{{ obj.position.map(v => v.toFixed(1)).join(', ') }}</span>
          </div>
          <div v-if="objs.length > 8" class="obj-more">... 还有 {{ objs.length - 8 }} 个</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 400px;
  max-height: calc(100vh - 20px);
  overflow-y: auto;
  background: rgba(8, 8, 20, 0.94);
  border: 1px solid #2a2a44;
  border-radius: 8px;
  padding: 14px;
  z-index: 10;
  font-family: 'Segoe UI', 'PingFang SC', monospace;
  font-size: 13px;
  color: #c8c8d8;
  user-select: none;
  backdrop-filter: blur(6px);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #1a1a30;
}

.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #00ff88;
  flex-shrink: 0;
}
.status-dot.idle      { background: #00ff88; }
.status-dot.parsing   { background: #ffaa00; animation: pulse 0.5s infinite; }
.status-dot.navigating { background: #0088ff; animation: pulse 0.5s infinite; }
.status-dot.collision { background: #ff4444; }
.status-dot.querying  { background: #ffaa00; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  color: #d0d0e0;
  font-weight: 600;
}

.spinner { color: #ffaa00; }

.obj-count {
  margin-left: auto;
  color: #666;
  font-size: 11px;
}

/* ---- Selected card ---- */
.selected-card {
  background: #0a2a1a;
  border: 1px solid #00ff88;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
}

.selected-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.selected-header b { color: #00ff88; }

.selected-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: #1a3a2a;
  color: #88cc88;
  border-radius: 3px;
}

.btn-close {
  margin-left: auto;
  cursor: pointer;
  color: #ff6666;
  font-size: 14px;
  padding: 0 4px;
}
.btn-close:hover { color: #ff0000; }

.selected-pos {
  color: #aaa;
  font-size: 11px;
  margin-bottom: 4px;
}

.selected-hint {
  font-size: 10px;
  color: #668866;
}

/* ---- Hint bar ---- */
.hint-bar {
  padding: 6px 10px;
  background: #141428;
  border-radius: 4px;
  font-size: 11px;
  color: #777;
  margin-bottom: 10px;
  border-left: 3px solid #444;
}

/* ---- Section ---- */
.section {
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-title.toggle {
  cursor: pointer;
  color: #666;
  border-top: 1px solid #1a1a30;
  padding-top: 8px;
  margin-top: 8px;
}
.section-title.toggle:hover { color: #aaa; }

/* ---- Inputs ---- */
.input {
  width: 100%;
  padding: 10px 12px;
  background: #14142a;
  border: 1px solid #333;
  border-radius: 5px;
  color: #e0e0e0;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.input:focus { border-color: #5566cc; }
.input::placeholder { color: #555; }

.input-textarea {
  resize: vertical;
  line-height: 1.5;
}

.input-row {
  display: flex;
  gap: 6px;
}
.input-row .input { flex: 1; }

/* ---- Buttons ---- */
.btn-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.btn {
  padding: 9px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  font-family: inherit;
  transition: opacity 0.2s, transform 0.1s;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-green  { background: #00cc66; color: #000; }
.btn-purple { background: #6644ff; color: #fff; min-width: 70px; font-size: 12px; }
.btn-red    { background: #cc3333; color: #fff; }

.btn-green:hover:not(:disabled)  { background: #00dd77; }
.btn-purple:hover:not(:disabled) { background: #7755ff; }
.btn-red:hover:not(:disabled)    { background: #dd4444; }

/* ---- Result ---- */
.result-box {
  margin-bottom: 8px;
  padding: 10px 12px;
  background: #0a0a18;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
  border-left: 3px solid #00cc66;
}
.result-box.error {
  border-left-color: #cc3333;
  color: #ff8888;
}

/* ---- Object list ---- */
.obj-list {
  max-height: 220px;
  overflow-y: auto;
}

.tag-group {
  margin-bottom: 6px;
}

.tag-name {
  color: #ccaa44;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 2px;
}

.tag-count {
  color: #666;
  font-weight: normal;
  font-size: 10px;
}

.obj-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 8px;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.1s;
}
.obj-row:hover { background: #1a1a30; }
.obj-row.selected {
  background: #0a2a1a;
  color: #00ff88;
}

.obj-id { color: #aaa; }
.obj-coord { font-size: 10px; color: #666; font-family: 'Consolas', monospace; }
.obj-row.selected .obj-coord { color: #448844; }

.obj-more {
  padding-left: 8px;
  font-size: 10px;
  color: #555;
}

.path-status-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}
.path-status-badge.moving { background: #1a3a5a; color: #44aaff; }
.path-status-badge.arrived { background: #0a2a1a; color: #00ff88; }
.path-status-badge.blocked { background: #3a1a1a; color: #ff6644; }
.path-status-badge.unreachable { background: #3a1a1a; color: #ff4444; font-weight: bold; }
.path-status-badge.planning { background: #1a1a3a; color: #ffaa00; }
</style>
