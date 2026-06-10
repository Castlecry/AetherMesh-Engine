import type { IInstruction, SceneObject } from '@/types'
import { ENGINE_CONFIG } from '@/config'

// Mock parser for offline development
function mockParse(userInput: string, sceneObjects: SceneObject[]): IInstruction {
  const input = userInput.trim()

  if (/停[下止]?|别动|stop/i.test(input)) {
    return { action: 'stop', params: { reason: 'user_request' }, raw: '' }
  }

  if (/然后|接着|并且|之后/.test(input)) {
    return { action: 'unknown', params: { message: '请一次只说一个操作' }, raw: '' }
  }

  const moveMatch = input.match(/移动|去|走到|导航|move/i)
  if (moveMatch) {
    const coordMatch = input.match(/\(?\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\s*[,，]\s*(-?[\d.]+)\)?/)
    if (coordMatch) {
      const target = [parseFloat(coordMatch[1]), parseFloat(coordMatch[2]), parseFloat(coordMatch[3])]
      return { action: 'move_to', params: { target, avoid_tags: ['static_obstacle'] }, raw: '' }
    }

    for (const obj of sceneObjects) {
      if (input.includes(obj.tag) || input.includes(obj.id)) {
        return {
          action: 'move_to',
          params: { target: obj.position, avoid_tags: ['static_obstacle', obj.tag] },
          raw: ''
        }
      }
    }

    // Multi-object disambiguation
    const mentionedTag = sceneObjects.find(o => o.tag !== 'robot' && input.includes(o.tag))
    if (mentionedTag) {
      const candidates = sceneObjects
        .filter(o => o.tag === mentionedTag.tag)
        .map(o => ({
          id: o.id,
          desc: `${o.tag} 位于 (${o.position[0].toFixed(1)}, ${o.position[1].toFixed(1)}, ${o.position[2].toFixed(1)})`,
          position: o.position
        }))
      if (candidates.length > 1) {
        return { action: 'query_user', params: { target_object: mentionedTag.tag, candidates }, raw: '' }
      }
    }

    return { action: 'unknown', params: { message: '请指定具体目标位置或物体' }, raw: '' }
  }

  if (/拿[起取]|抓取|拾取|pick/i.test(input)) {
    const objMatch = input.match(/(?:拿[起取]|抓取|拾取|pick\w*)\s*(.+)/i)
    const objName = objMatch ? objMatch[1].trim() : 'unknown'
    return { action: 'pick_up', params: { object_id: objName }, raw: '' }
  }

  if (/那边|这里|那里|一点|一下/.test(input) && !/\(/.test(input)) {
    return { action: 'unknown', params: { message: '指令模糊，无法确定具体目标位置' }, raw: '' }
  }

  return { action: 'unknown', params: { message: '无法识别指令' }, raw: '' }
}

export async function parseInstruction(
  userInput: string,
  sceneObjects: SceneObject[]
): Promise<IInstruction> {
  if (ENGINE_CONFIG.ai.mode === 'mock') {
    return mockParse(userInput, sceneObjects)
  }

  // Real mode: call backend API, which proxies to Ollama
  const url = `${ENGINE_CONFIG.ai.backendUrl}/api/parse`

  for (let attempt = 0; attempt <= ENGINE_CONFIG.ai.retryCount; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: userInput.trim(), sceneObjects })
      })

      if (!response.ok) {
        console.warn(`[ollamaClient] Attempt ${attempt + 1}: HTTP ${response.status}`)
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
        continue
      }

      const data = await response.json()
      if (data.action) return data as IInstruction

      console.warn(`[ollamaClient] Attempt ${attempt + 1}: invalid response`)
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    } catch (err) {
      console.warn(`[ollamaClient] Attempt ${attempt + 1}:`, err)
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
  }

  return {
    action: 'unknown',
    params: { message: 'AI 服务暂时不可用，请稍后重试' },
    raw: ''
  }
}
