import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SceneObject, CollisionPair, IInstruction, ProfilerSnapshot } from '@/types'

export const useSimulationStore = defineStore('simulation', () => {
  const sceneObjects = ref<SceneObject[]>([])
  const robotPosition = ref<[number, number, number]>([0, 0.3, 0])
  const robotTarget = ref<[number, number, number] | null>(null)
  const status = ref<'idle' | 'navigating' | 'collision' | 'querying'>('idle')
  const collisions = ref<CollisionPair[]>([])
  const profilerHistory = ref<ProfilerSnapshot[]>([])
  const queryUserCandidates = ref<any[]>([])

  const isRobotMoving = computed(() => status.value === 'navigating')
  const latestCollisions = computed(() => collisions.value)

  function initScene(objects: SceneObject[]) {
    sceneObjects.value = [...objects]
    robotPosition.value = [...objects[0].position]
    status.value = 'idle'
  }

  function executeInstruction(inst: IInstruction) {
    switch (inst.action) {
      case 'move_to': {
        const target = inst.params.target as [number, number, number]
        if (!target || target.length !== 3) return
        robotTarget.value = target
        status.value = 'navigating'
        break
      }
      case 'stop': {
        robotTarget.value = null
        status.value = 'idle'
        break
      }
      case 'query_user': {
        queryUserCandidates.value = (inst.params.candidates as any[]) || []
        status.value = 'querying'
        break
      }
      case 'unknown': {
        status.value = 'idle'
        console.log('[SimStore] Unknown instruction:', inst.params.message)
        break
      }
      default:
        console.log('[SimStore] Unhandled action:', inst.action)
    }
  }

  function resolveQueryUser(choiceIndex: number) {
    const candidate = queryUserCandidates.value[choiceIndex]
    if (!candidate) return
    queryUserCandidates.value = []
    status.value = 'idle'
    robotTarget.value = candidate.position
    status.value = 'navigating'
  }

  function setCollisions(newCollisions: CollisionPair[]) {
    collisions.value = newCollisions
    if (newCollisions.length > 0 && status.value === 'navigating') {
      status.value = 'collision'
    }
  }

  function updateRobotPosition(pos: [number, number, number]) {
    robotPosition.value = pos
    if (sceneObjects.value.length > 0) {
      sceneObjects.value[0].position = pos
    }
  }

  function addProfilerSnapshot(snap: ProfilerSnapshot) {
    profilerHistory.value.push(snap)
    if (profilerHistory.value.length > 600) {
      profilerHistory.value.shift()
    }
  }

  function setStatus(s: 'idle' | 'navigating' | 'collision' | 'querying') {
    status.value = s
  }

  return {
    sceneObjects, robotPosition, robotTarget, status, collisions,
    profilerHistory, queryUserCandidates,
    isRobotMoving, latestCollisions,
    initScene, executeInstruction, resolveQueryUser,
    setCollisions, updateRobotPosition, addProfilerSnapshot, setStatus
  }
})
