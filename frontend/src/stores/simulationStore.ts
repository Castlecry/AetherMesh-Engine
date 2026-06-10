import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SceneObject, CollisionPair, IInstruction, ProfilerSnapshot } from '@/types'

export type PathStatus = 'idle' | 'planning' | 'moving' | 'blocked' | 'arrived' | 'unreachable'

export const useSimulationStore = defineStore('simulation', () => {
  const sceneObjects = ref<SceneObject[]>([])
  const robotPosition = ref<[number, number, number]>([0, 0.3, 0])
  const robotTarget = ref<[number, number, number] | null>(null)
  const status = ref<'idle' | 'navigating' | 'collision' | 'querying'>('idle')
  const pathStatus = ref<PathStatus>('idle')
  const waypoints = ref<[number, number, number][]>([])
  const currentWaypointIndex = ref(0)
  const collisions = ref<CollisionPair[]>([])
  const profilerHistory = ref<ProfilerSnapshot[]>([])
  const queryUserCandidates = ref<any[]>([])
  const selectedObjectId = ref<string | null>(null)

  const isRobotMoving = computed(() => status.value === 'navigating')
  const latestCollisions = computed(() => collisions.value)
  const selectedObject = computed(() =>
    sceneObjects.value.find(o => o.id === selectedObjectId.value) ?? null
  )

  function initScene(objects: SceneObject[]) {
    sceneObjects.value = [...objects]
    robotPosition.value = [...objects[0].position]
    status.value = 'idle'
    pathStatus.value = 'idle'
    waypoints.value = []
    currentWaypointIndex.value = 0
    selectedObjectId.value = null
  }

  function selectObject(id: string | null) {
    selectedObjectId.value = id
  }

  /** Set a path of waypoints for the robot to follow */
  function setPath(wps: [number, number, number][]) {
    waypoints.value = wps
    currentWaypointIndex.value = 0
    if (wps.length > 0) {
      pathStatus.value = 'moving'
      robotTarget.value = wps[0]
      status.value = 'navigating'
    }
  }

  /** Move to next waypoint or finish */
  function advanceWaypoint() {
    currentWaypointIndex.value++
    if (currentWaypointIndex.value < waypoints.value.length) {
      robotTarget.value = waypoints.value[currentWaypointIndex.value]
    } else {
      // Path complete
      pathStatus.value = 'arrived'
      status.value = 'idle'
      robotTarget.value = null
      waypoints.value = []
      currentWaypointIndex.value = 0
    }
  }

  /** Clicking ground always moves the robot */
  function moveSelectedTo(target: [number, number, number]) {
    const targetPos: [number, number, number] = [
      Math.round(target[0] * 10) / 10,
      0.3,
      Math.round(target[2] * 10) / 10,
    ]
    setPath([targetPos])
  }

  function executeInstruction(inst: IInstruction) {
    switch (inst.action) {
      case 'move_to': {
        const target = inst.params.target as [number, number, number]
        if (!target || target.length !== 3) return
        setPath([target])
        break
      }
      case 'follow_path': {
        const wps = inst.params.waypoints as [number, number, number][]
        if (!wps || !Array.isArray(wps) || wps.length === 0) return
        setPath(wps)
        break
      }
      case 'stop': {
        robotTarget.value = null
        waypoints.value = []
        currentWaypointIndex.value = 0
        status.value = 'idle'
        pathStatus.value = 'idle'
        break
      }
      case 'query_user': {
        queryUserCandidates.value = (inst.params.candidates as any[]) || []
        status.value = 'querying'
        break
      }
      case 'unknown': {
        // If AI returned unknown with an "unreachable" message, reflect that
        const msg = String(inst.params.message ?? '')
        if (msg.includes('不可达') || msg.includes('unreachable') || msg.includes('无法到达')) {
          pathStatus.value = 'unreachable'
        }
        console.log('[SimStore] Unknown:', msg)
        break
      }
      default:
        console.log('[SimStore] Unhandled:', inst.action)
    }
  }

  function resolveQueryUser(choiceIndex: number) {
    const candidate = queryUserCandidates.value[choiceIndex]
    if (!candidate) return
    queryUserCandidates.value = []
    robotTarget.value = candidate.position
    status.value = 'navigating'
  }

  function setCollisions(newCollisions: CollisionPair[]) {
    collisions.value = newCollisions
    if (newCollisions.length > 0 && status.value === 'navigating') {
      status.value = 'collision'
      pathStatus.value = 'blocked'
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
    if (profilerHistory.value.length > 600) profilerHistory.value.shift()
  }

  function setStatus(s: 'idle' | 'navigating' | 'collision' | 'querying') {
    status.value = s
  }

  return {
    sceneObjects, robotPosition, robotTarget, status, pathStatus,
    waypoints, currentWaypointIndex, collisions, profilerHistory,
    queryUserCandidates, selectedObjectId, selectedObject,
    isRobotMoving, latestCollisions,
    initScene, executeInstruction, resolveQueryUser, selectObject, moveSelectedTo,
    setPath, advanceWaypoint,
    setCollisions, updateRobotPosition, addProfilerSnapshot, setStatus
  }
})
