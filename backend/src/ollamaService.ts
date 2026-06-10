import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ---- Types ----

interface SceneObject {
  id: string
  tag: string
  position: [number, number, number]
  halfExtents: [number, number, number]
  meshType: 'box' | 'sphere'
  color?: [number, number, number]
}

interface IInstruction {
  action: 'move_to' | 'pick_up' | 'place_down' | 'follow_path'
         | 'query' | 'query_user' | 'stop' | 'unknown'
  params: Record<string, unknown>
  raw: string
}

// ---- Config ----

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5:9b'
const AI_MODE = (process.env.AI_MODE ?? 'mock') as 'real' | 'mock'
const RETRY_COUNT = parseInt(process.env.AI_RETRY_COUNT ?? '2', 10)

// ---- Helper ----

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function ollamaFetch(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: false }),
  })
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const data = await res.json()
  return data.response ?? ''
}

// ---- Health check ----

export async function checkOllamaHealth(): Promise<{ reachable: boolean; model: string; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return { reachable: false, model: OLLAMA_MODEL, error: `HTTP ${res.status}` }
    const data = await res.json()
    const names: string[] = (data.models ?? []).map((m: any) => m.name)
    const has = names.some((n: string) => n.startsWith(OLLAMA_MODEL))
    return { reachable: true, model: OLLAMA_MODEL, error: has ? undefined : `model not found. Available: ${names.join(', ')}` }
  } catch (err: any) {
    return { reachable: false, model: OLLAMA_MODEL, error: err?.message ?? String(err) }
  }
}

// ---- Prompt loading ----

const __dirname = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(resolve(__dirname, '../../ai/system_prompt.txt'), 'utf-8')

const VALID_ACTIONS = new Set([
  'move_to', 'pick_up', 'place_down', 'follow_path',
  'query', 'query_user', 'stop', 'unknown'
])

function buildSceneObjectsBlock(objects: SceneObject[]): string {
  if (objects.length === 0) return '（场景中暂无物体）'
  // Include position AND size so AI can plan paths around obstacles
  return objects.map(o =>
    `- ${o.id} pos=(${o.position.map(v => v.toFixed(1)).join(',')}) size=(${o.halfExtents.map(v => v.toFixed(1)).join(',')}) tag=${o.tag}`
  ).join('\n')
}

function validateAndParse(raw: string): IInstruction | null {
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  let parsed: any
  try { parsed = JSON.parse(cleaned) } catch {
    const m = cleaned.match(/\{[\s\S]*?\}/)
    if (!m) return null
    try { parsed = JSON.parse(m[0]) } catch { return null }
  }
  if (!parsed.action || !VALID_ACTIONS.has(parsed.action)) return null
  const { action, ...params } = parsed
  return { action: action as IInstruction['action'], params, raw: cleaned }
}

// ---- Instruction parsing ----

async function callOllama(userInput: string, sceneObjects: SceneObject[]): Promise<IInstruction> {
  const sceneBlock = buildSceneObjectsBlock(sceneObjects)
  const fullSystem = SYSTEM_PROMPT.replace('{{SCENE_OBJECTS}}', sceneBlock)

  let lastErr = ''
  for (let i = 0; i <= RETRY_COUNT; i++) {
    try {
      const text = await ollamaFetch({
        model: OLLAMA_MODEL,
        system: fullSystem,
        prompt: userInput,
        options: { temperature: 0.1, top_p: 0.9 }
      })
      const parsed = validateAndParse(text)
      if (parsed) return parsed
      console.warn(`[ollamaService] validation failed, got: ${text.slice(0, 200)}`)
      await delay(500 * (i + 1))
    } catch (err: any) {
      lastErr = err?.message ?? String(err)
      console.warn(`[ollamaService] attempt ${i + 1}: ${lastErr}`)
      await delay(500 * (i + 1))
    }
  }
  return { action: 'unknown', params: { message: lastErr || 'AI 服务不可用' }, raw: '' }
}

// ---- Scene generation ----

const SCENE_GEN_PROMPT = [
  '你是3D场景生成器。根据用户描述输出一个JSON数组。',
  '物体格式: {"id":"obj_N","tag":"类别","position":[x,y,z],"halfExtents":[w,h,d],"meshType":"box|sphere","color":[r,g,b]}',
  '规则: obj_0是robot在[0,0.3,0]; x,z∈[-8,8] y∈[0.2,2]; halfExtents每个∈[0.1,1.0]; 物体间保持间距不重叠; 数量5-60个。',
  '只输出JSON数组，禁止解释、Markdown。',
].join('\n')

function parseSceneJSON(raw: string): SceneObject[] | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  if (!arrMatch) { console.warn('[sceneGen] no JSON array found in:', cleaned.slice(0, 300)); return null }
  try {
    const parsed = JSON.parse(arrMatch[0])
    if (!Array.isArray(parsed)) return null
    return parsed.filter((item: any) =>
      item.id && item.tag && Array.isArray(item.position) && item.position.length === 3 &&
      Array.isArray(item.halfExtents) && item.halfExtents.length === 3
    ).map((item: any) => ({
      id: String(item.id),
      tag: String(item.tag),
      position: item.position.map(Number) as [number, number, number],
      halfExtents: item.halfExtents.map(Number) as [number, number, number],
      meshType: item.meshType === 'sphere' ? 'sphere' : 'box' as 'box' | 'sphere',
      color: Array.isArray(item.color) && item.color.length === 3
        ? item.color.map(Number) as [number, number, number]
        : [0.4 + Math.random() * 0.4, 0.4 + Math.random() * 0.4, 0.5 + Math.random() * 0.4]
    }))
  } catch (e) {
    console.warn('[sceneGen] JSON parse error:', e, 'raw:', cleaned.slice(0, 300))
    return null
  }
}

export async function generateScene(description: string): Promise<SceneObject[]> {
  console.log(`[sceneGen] AI_MODE=${AI_MODE} OLLAMA_URL=${OLLAMA_URL}`)

  if (AI_MODE !== 'real') {
    throw new Error(`场景生成需要 Real AI 模式，当前为 ${AI_MODE}`)
  }

  let lastErr = ''
  for (let i = 0; i <= RETRY_COUNT; i++) {
    try {
      console.log(`[sceneGen] attempt ${i + 1}: calling Ollama...`)
      const text = await ollamaFetch({
        model: OLLAMA_MODEL,
        system: SCENE_GEN_PROMPT,
        prompt: `生成以下场景：${description}`,
        options: { temperature: 0.3, top_p: 0.95 }
      })
      console.log(`[sceneGen] Ollama response (${text.length} chars): ${text.slice(0, 200)}`)
      const objects = parseSceneJSON(text)
      if (objects && objects.length > 0) return objects
      console.warn(`[sceneGen] attempt ${i + 1}: parse failed`)
      await delay(800 * (i + 1))
    } catch (err: any) {
      lastErr = err?.message ?? String(err)
      console.error(`[sceneGen] attempt ${i + 1} ERROR: ${lastErr}`)
      await delay(800 * (i + 1))
    }
  }
  throw new Error(lastErr || 'Ollama 无法访问，请确认服务正在运行')
}

// ---- Mock parsers ----

function mockParse(userInput: string, sceneObjects: SceneObject[]): IInstruction {
  const input = userInput.trim()
  if (/停[下止]?|别动|stop/i.test(input)) return { action: 'stop', params: { reason: 'user_request' }, raw: '' }
  if (/然后|接着|并且|之后/.test(input)) return { action: 'unknown', params: { message: '请一次只说一个操作' }, raw: '' }

  const moveMatch = input.match(/移动|去|走到|导航|move/i)
  if (moveMatch) {
    const coordMatch = input.match(/\(?\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\)?/)
    if (coordMatch) {
      return { action: 'move_to', params: { target: [parseFloat(coordMatch[1]), parseFloat(coordMatch[2]), parseFloat(coordMatch[3])], avoid_tags: ['static_obstacle'] }, raw: '' }
    }
    for (const obj of sceneObjects) {
      if (input.includes(obj.tag) || input.includes(obj.id)) {
        return { action: 'move_to', params: { target: obj.position, avoid_tags: ['static_obstacle', obj.tag] }, raw: '' }
      }
    }
    const mentionedTag = sceneObjects.find(o => o.tag !== 'robot' && input.includes(o.tag))
    if (mentionedTag) {
      const candidates = sceneObjects.filter(o => o.tag === mentionedTag.tag).map(o => ({
        id: o.id, desc: `${o.tag} (${o.position[0].toFixed(1)},${o.position[1].toFixed(1)},${o.position[2].toFixed(1)})`, position: o.position
      }))
      if (candidates.length > 1) return { action: 'query_user', params: { target_object: mentionedTag.tag, candidates }, raw: '' }
    }
    return { action: 'unknown', params: { message: '请指定具体目标位置或物体' }, raw: '' }
  }
  if (/拿[起取]|抓取|拾取|pick/i.test(input)) {
    const m = input.match(/(?:拿[起取]|抓取|拾取|pick\w*)\s*(.+)/i)
    return { action: 'pick_up', params: { object_id: m ? m[1].trim() : 'unknown' }, raw: '' }
  }
  return { action: 'unknown', params: { message: '无法识别指令，请使用: 移动到 (x,y,z) 或点击场景交互' }, raw: '' }
}

// ---- Public API ----

export async function parseInstruction(userInput: string, sceneObjects: SceneObject[]): Promise<IInstruction> {
  if (AI_MODE !== 'real') return mockParse(userInput, sceneObjects)
  return callOllama(userInput, sceneObjects)
}
