import express from 'express'
import cors from 'cors'
import { parseInstruction, generateScene, checkOllamaHealth } from './ollamaService.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '512kb' }))

// === Health check (with Ollama connectivity test) ===
app.get('/api/health', async (_req, res) => {
  const ollamaStatus = await checkOllamaHealth()
  res.json({
    status: 'ok',
    ollama: ollamaStatus,
    model: process.env.OLLAMA_MODEL ?? 'qwen3.5:9b',
    mode: process.env.AI_MODE ?? 'mock',
    timestamp: Date.now()
  })
})

// === AI instruction parsing ===
app.post('/api/parse', async (req, res) => {
  const { userInput, sceneObjects } = req.body

  if (!userInput || typeof userInput !== 'string') {
    res.status(400).json({ error: '缺少 userInput 字段' })
    return
  }
  if (!Array.isArray(sceneObjects)) {
    res.status(400).json({ error: '缺少 sceneObjects 数组' })
    return
  }

  try {
    const instruction = await parseInstruction(userInput.trim(), sceneObjects)
    res.json(instruction)
  } catch (err: any) {
    console.error('[backend] parse error:', err)
    res.status(500).json({
      action: 'unknown',
      params: { message: `AI 解析失败: ${err?.message ?? err}` },
      raw: ''
    })
  }
})

// === Natural language scene generation ===
app.post('/api/generate-scene', async (req, res) => {
  const { description } = req.body

  if (!description || typeof description !== 'string') {
    res.status(400).json({ error: '缺少 description 字段' })
    return
  }

  try {
    console.log(`[backend] Generating scene for: "${description}"`)
    const objects = await generateScene(description.trim())
    console.log(`[backend] Generated ${objects.length} objects`)
    res.json({ objects })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('[backend] generate-scene error:', msg)
    res.status(500).json({ error: `场景生成失败: ${msg}` })
  }
})

// === Config ===
app.get('/api/config', (_req, res) => {
  res.json({
    model: process.env.OLLAMA_MODEL ?? 'qwen3.5:9b',
    mode: process.env.AI_MODE ?? 'mock',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  })
})

const PORT = parseInt(process.env.PORT ?? '3001', 10)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] AetherMesh API server on port ${PORT}`)
  console.log(`[backend] Ollama → ${process.env.OLLAMA_URL ?? 'http://localhost:11434'}`)
  console.log(`[backend] Model  → ${process.env.OLLAMA_MODEL ?? 'qwen3.5:9b'}`)
  console.log(`[backend] Mode   → ${process.env.AI_MODE ?? 'mock'}`)
})
