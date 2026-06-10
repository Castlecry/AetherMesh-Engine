好的，你需要的是一套**能够驱动 AetherMesh Engine 引擎的端侧大模型 Prompt 系统**，用于将自然语言指令精准转换为底层 C++ 几何内核可执行的 JSON 空间指令。下面我会根据你的项目文档和要求（特别是“Prompt 防火墙强约束、JSON Mode、零废话、零 Markdown”），为你提供完整的 Prompt 设计方案、调用参数建议以及可落地的示例。

---

## 一、Prompt 设计核心原则（对齐你的项目）

1. **输出格式绝对纯净**：只输出一个 JSON 对象，不包含任何自然语言、注释、Markdown 标记（如 ```json ... ```）。
2. **Schema 严格预定义**：所有动作和参数必须符合预先定义的结构，无法识别的请求优雅降级为 `{ "action": "unknown", ... }` 或者安全回退。
3. **几何约束优先**：模型只负责语义到结构化指令的映射，具体的碰撞检测、BVH 遍历由 C++ 内核完成，因此 Prompt 不需要模型思考几何可行性，只要求输出合理的意图参数。
4. **Few-shot 硬约束**：给出 3-5 个典型示例，覆盖移动、拾取、放置、查询等常见操作，让模型学会强制输出模式。
5. **容错与熔断配合**：Prompt 本身不负责校验（由前端 JSON Schema 完成），但要求模型永远不输出多余内容。

---

## 二、System Prompt（可直接复制使用）

```text
你是一个专门服务于具身智能仿真引擎“AetherMesh Engine”的指令解析模块。你的唯一功能是将用户的自然语言请求转换为严格格式化的 JSON 指令，供底层 C++ 几何计算内核执行。

【输出规则】
- 只输出一个 JSON 对象，禁止输出任何解释、问候、Markdown 代码块标记或额外字符。
- 所有 JSON 必须符合以下 Schema 之一。如果无法识别用户意图，输出 {"action": "unknown", "message": "指令无法识别"}。

【允许的 action 类型及对应参数】
1. move_to
   - target: [x, y, z]   (浮点数数组，三维坐标，单位：米)
   - avoid_tags: 可选，字符串数组，如 ["table", "chair", "wall"]，表示需要避开的物体类别。

2. pick_up
   - object_id: 字符串，物体唯一标识（如 "cup_01", "book"）
   - grasp_pose: 可选，[x, y, z] 三维坐标，指定抓取点，缺省则由内核自动计算。

3. place_down
   - target: [x, y, z]  放置位置坐标
   - orientation: 可选，字符串 "normal" / "upright" 等

4. follow_path
   - waypoints: [[x1,y1,z1], [x2,y2,z2], ...]  路径点数组（至少2个）

5. query
   - target: 字符串，可取值 "position" / "distance_to" / "is_colliding"
   - object_id: 字符串，被查询的物体

6. unknown
   - message: 简短说明无法解析的原因

【强制行为】
- 坐标值范围：x ∈ [-10,10]，y ∈ [0,2]（地面高度），z ∈ [-10,10]。
- avoid_tags 默认包含 ["static_obstacle"]，你可以根据上下文增加其他标签。
- 如果用户提到“快速移动”、“安全移动”等修饰，忽略它们（几何内核会自行规划速度）。
- 如果目标坐标明显超出场景边界（如绝对值 > 12），输出 unknown 并提示“目标超出场景范围”。

【Few-shot 示例】

用户：移动到桌子旁边，避开椅子。
输出：{"action": "move_to", "target": [2.5, 0, 1.8], "avoid_tags": ["table", "chair"]}

用户：把红杯子拿起来。
输出：{"action": "pick_up", "object_id": "red_cup", "grasp_pose": null}

用户：沿着 (0,0,0), (1,0,1), (2,0,0) 走。
输出：{"action": "follow_path", "waypoints": [[0,0,0], [1,0,1], [2,0,0]]}

用户：现在机器人在哪里？
输出：{"action": "query", "target": "position", "object_id": "robot"}

用户：带我去月球。
输出：{"action": "unknown", "message": "目标超出场景范围"}

现在，请只输出 JSON，不要有任何额外内容。
```

---

## 三、User Prompt 示例（由前端拼接）

当用户在前端输入自然语言后，前端直接将该句子作为 User Prompt 发送给 Ollama，无需任何额外包装。

例如用户输入：  
`“移动到沙发前面，避开茶几和地毯。”`

则 User Prompt 为：  
`移动到沙发前面，避开茶几和地毯。`

---

## 四、Ollama 调用参数建议（与你 5070 Ti + Qwen3.5:9b 配合）

在 `ollamaClient.ts` 中调用时，建议使用如下参数以强制纯净 JSON 输出：

```json
{
  "model": "qwen3.5:9b",
  "prompt": "<system_prompt内容>\n\n用户输入：...",
  "stream": false,
  "options": {
    "temperature": 0.1,
    "top_p": 0.9,
    "repeat_penalty": 1.1,
    "stop": ["\n\n", "```"]   // 提前终止可能的多余输出
  }
}
```

- **temperature = 0.1**：极低随机性，保证输出稳定。
- **stop 序列**：一旦遇到两个换行或代码块标记立即停止，防止模型继续输出解释。
- **建议使用非流式（stream: false）**，因为 JSON 一般较短，流式会增加前端解析复杂度。但如果希望体验打字机效果也可以保留，但要保证完整 JSON 拼接后再校验。

---

## 五、前端熔断与校验（配合你的 JSON Schema）

你的 `ControlPanel.vue` 中已经计划做 JSON Schema 校验，这里补充一个校验示例（使用 `ajv` 或简单正则）：

```typescript
const validActions = new Set(['move_to', 'pick_up', 'place_down', 'follow_path', 'query', 'unknown']);

function validateAIOutput(raw: string): any | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (!validActions.has(parsed.action)) return null;
    // 针对 move_to 检查 target 是否为长度为3的数组
    if (parsed.action === 'move_to') {
      if (!Array.isArray(parsed.target) || parsed.target.length !== 3) return null;
      if (parsed.target.some(v => typeof v !== 'number')) return null;
    }
    // 其他 action 的校验按需添加
    return parsed;
  } catch {
    return null;
  }
}
```

校验失败 → 触发重试机制（最多2次）→ 若仍失败，输出 `unknown` 动作并提示用户。

---

## 六、可能的扩展：多轮对话上下文（如果需要）

如果希望机器人能记住前面指令（比如“然后把它放到桌子上”），你需要在前端维护一个简短的对话历史，并在每次调用时把最近 2-3 轮问答作为上下文注入到 User Prompt 中。但注意，这会增加复杂度和 token 消耗，建议**初期先做无状态单轮解析**，因为你的场景是“指令→立即执行几何校验”，不需要长期记忆。

---

## 七、测试你的 Prompt（模拟结果）

用 Qwen3.5:9b 量化版测试几个例子（预期输出）：

| 用户输入 | 模型输出（仅 JSON） |
|---------|---------------------|
| 移动到 (1,0,2) 并避开所有家具 | `{"action": "move_to", "target": [1,0,2], "avoid_tags": ["static_obstacle", "furniture"]}` |
| 拿起蓝色花瓶 | `{"action": "pick_up", "object_id": "blue_vase", "grasp_pose": null}` |
| 这里安全吗？ | `{"action": "query", "target": "is_colliding", "object_id": "robot"}` |
| 飞上天 | `{"action": "unknown", "message": "目标超出场景范围"}` |

---

## 八、最终交付物（配合你的项目计划）

按照你的项目计划书，在 **阶段四（AI 闭环）** 中，你只需要：

1. 将上面的 System Prompt 保存到 `ai/system_prompt.txt`。
2. 在 `ollamaClient.ts` 中实现上述调用逻辑。
3. 在 `ControlPanel.vue` 中集成校验 + 重试 + 发送到 Wasm 内核。
4. 测试端到端：输入“移动到门口” → JSON 输出 → C++ 内核 BVH 碰撞检测 → 若路径无碰撞则执行移动，否则回退。

这套 Prompt 完全满足你文档中要求的 **“强约束 JSON Schema 防火墙”**、**“剥夺冗余输出能力”**，并且与底层几何内核解耦。

如果需要更复杂的指令（比如“沿着墙走，距离墙面 0.2 米”），可以在后续版本中扩展 `follow_path` 或增加 `constraints` 字段，但当前版本足够证明你的技术完整性。

祝你顺利完成 AetherMesh Engine 项目，拿下校招亮点！