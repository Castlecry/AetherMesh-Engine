# AetherMesh Engine — 实施方案设计文档

**日期**: 2026-06-10  
**状态**: 已确认  
**设计原则**: Solo 开发、微迭代、层间解耦、每 Sprint 可运行可演示

---

## 一、Sprint 拆解（共 10 个 Sprint）

每个 Sprint 产出**一个可运行、可演示的最小能力增量**，粒度适配 solo 开发节奏（晚间 + 周末）。

| Sprint | 目标 | 核心产出 | 依赖 |
|--------|------|---------|------|
| **S1** | 3D 舞台搭起来 | Three.js 场景 + 摄像机 + 灯光 + 地面网格 + OrbitControls，`npm run dev` 可交互 | 无 |
| **S2** | 场景有内容了 | 100+ 随机立方体 InstancedMesh 批量渲染，不同颜色，稳定 60FPS，假数据驱动 | S1 |
| **S3** | 能看到性能了 | Profiler 面板：实时 FPS 折线图 + DrawCall + 内存占用，canvas 手绘或 stats.js | S2 |
| **S4** | C++ 开张了 | CMake + Emscripten 编译链跑通，C++ `add(a,b)` → Wasm → JS 调用验证 | 无 |
| **S5** | 算力通道打通 | Embind 绑定 EngineCore 类，Float32Array 零拷贝传 10000 顶点 → C++ 处理 → 回传，延迟 <1ms | S4 |
| **S6** | 空间索引可视化 | C++ SAH-BVH 构建 + traverse，包围盒回传前端，Three.js 线框可视化 | S5 |
| **S7** | 碰撞检测活了 | GJK 算法实现，碰撞对红色高亮，可手动移动机器人方块触发 | S6 |
| **S8** | AI 听懂了 | Plan B Prompt + ollamaClient.ts + ControlPanel 输入框 + JSON 校验熔断 + 场景物体列表动态注入 | 无 |
| **S9** | 全链路闭环 | 自然语言输入 → AI 解析 → Wasm 碰撞校验 → 物体移动/回退 → 3D 渲染 + Profiler | S5+S7+S8 |
| **S10** | 打磨收尾 | 性能调优、边界 Bug 修复、README/架构文档、演示视频准备 | S9 |

**关键设计决策**：

- **S6 把 BVH 可视化放在 GJK 碰撞之前**：在写碰撞算法之前就能肉眼验证空间索引正确性，避免"算法写完了但不知道哪里错了"
- **S4-S5 用最简单功能验证编译链和通信**：先用 `add(a,b)` 确认工具链无误，再引入复杂算法
- **S8 和 S9 分开**：AI 集成和全链路联调是独立风险源，分开定位更准

---

## 二、解耦架构

### 2.1 三层 + 两个接口面

```
┌─────────────────────────────────────────────────┐
│  AI 推理层 (ollamaClient.ts)                     │
│  ┌─────────────────────────────────────────────┐ │
│  │ Mock 模式: 返回固定 JSON, 不连 Ollama        │ │
│  └─────────────────────────────────────────────┘ │
│                     │                             │
│           Interface A: IInstruction               │
│           { action, params } → 校验 → 执行        │
│                     │                             │
├─────────────────────────────────────────────────┤
│  表现层 (Vue3 + Three.js)                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ Mock 模式: 用假位置数组驱动 InstancedMesh    │ │
│  └─────────────────────────────────────────────┘ │
│                     │                             │
│           Interface B: IComputeKernel             │
│           updatePositions() / getCollisions()     │
│                     │                             │
├─────────────────────────────────────────────────┤
│  C++ Wasm 内核                                    │
│  ┌─────────────────────────────────────────────┐ │
│  │ Mock 模式: 返回硬编码碰撞结果, 不跑 BVH/GJK  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2.2 两个接口契约

**Interface A — IInstruction（AI → 表现层）**：

AI 模型输出的原始 JSON 为平铺结构（如 `{"action":"move_to","target":[1,0,2]}`）。
校验层通过后将 `action` 之外的所有字段归一化到 `params`：

```typescript
interface IInstruction {
  action: 'move_to' | 'pick_up' | 'place_down' | 'follow_path'
         | 'query' | 'query_user' | 'stop' | 'unknown';
  params: Record<string, unknown>; // action 之外的所有字段（target, avoid_tags 等）
  raw: string;                     // AI 原始输出，用于调试
}
```

**Interface B — IComputeKernel（表现层 → Wasm）**：

```typescript
interface IComputeKernel {
  init(sceneObjects: SceneObject[]): void;
  updatePositions(positions: Float32Array): void;
  getCollisions(): CollisionPair[];
  getBVHTraversalTime(): number;
  dispose(): void;
}
```

### 2.3 每个 Sprint 的自救能力

| Sprint | 崩了影响谁 | 自救方案 |
|--------|-----------|---------|
| S1-S3 | 无 | 纯前端，无外部依赖 |
| S4 | S5-S7 | 环境问题回退到 S3，工具链修好再继续 |
| S5 | S6-S7 | Wasm 加载失败 → 自动降级 JS mock 内核 |
| S6 | S7 | BVH 崩 → mock 内核用暴力 O(N²) 检测，前端继续 |
| S7 | 无（S9 可用 mock 演示） | GJK 崩 → mock 返回 AABB 重叠即碰撞 |
| S8 | S9 | Ollama 不可用 → mock AI 返回预设指令 |
| S9 | 无 | 唯一真耦合 Sprint，但每个子模块都有 mock 降级 |
| S10 | 无 | 纯打磨 |

**核心原则**：真代码和 mock 代码共存于同一文件，通过 `config.ts` 全局开关切换，不删 mock。

---

## 三、核心数据流与接口

### 3.1 主数据流

```
用户输入: "移动到桌子旁边，避开椅子"
     │
     ▼
┌─────────────────────────────────────────────┐
│ 1. AI 层 (ollamaClient.ts)                   │
│    输入: 用户自然语言 + 场景物体列表注入       │
│    输出: IInstruction                        │
│    { action: "move_to",                      │
│      target: [3.2, 0.0, 1.5],               │
│      avoid_tags: ["table", "chair"] }        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼  JSON Schema 校验 + 坐标修正
                   │
┌──────────────────┴──────────────────────────┐
│ 2. 状态管理层 (useSimulationStore)            │
│    接收 IInstruction → 转为内部状态机          │
│    state: "idle" → "navigating"              │
│    targetPosition: [3.2, 0.0, 1.5]          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼  Float32Array 零拷贝
                   │
┌──────────────────┴──────────────────────────┐
│ 3. Wasm 内核 (engine_core.cpp)               │
│    输入: 目标位置 + 场景所有物体矩阵           │
│    处理: BVH 遍历 → GJK 碰撞检测              │
│    输出: 碰撞对列表 + 可行路径点               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼  Float32Array 零拷贝
                   │
┌──────────────────┴──────────────────────────┐
│ 4. 渲染层 (Stage3D.vue)                       │
│    读取: 物体位置数组 + 碰撞标记               │
│    渲染: InstancedMesh 批量更新矩阵            │
│          + 碰撞物体红色高亮                    │
│          + 移动路径绿色轨迹线                  │
└─────────────────────────────────────────────┘
```

### 3.2 核心数据结构

**场景物体（SceneObject）**—— 所有层共用：

```typescript
interface SceneObject {
  id: string;              // "robot" | "table_01" | "chair_03"
  tag: string;             // "robot" | "table" | "chair" | "static_obstacle"
  position: [number, number, number];
  halfExtents: [number, number, number]; // AABB 半尺寸 (宽, 高, 深)
  meshType: 'box' | 'sphere';
  color?: [number, number, number];      // RGB
}
```

**碰撞对（CollisionPair）**—— Wasm → 前端：

```typescript
interface CollisionPair {
  objectA: string;  // id
  objectB: string;  // id
  penetration: number;
  contactPoint: [number, number, number];
}
```

**性能快照（ProfilerSnapshot）**—— 每帧采集：

```typescript
interface ProfilerSnapshot {
  fps: number;
  drawCalls: number;
  memoryMB: number;
  bvhTraversalMs: number;     // 来自 Wasm
  gjkCallCount: number;       // 来自 Wasm
  aiLatencyMs: number;        // 来自 ollamaClient
  frameTimestamp: number;
}
```

### 3.3 数据流设计决策

- **场景物体列表是唯一状态源**：AI 层注入它（帮助模型理解场景），Wasm 内核读取它（构建 BVH），前端渲染它。只有 Pinia store 有权修改
- **零拷贝是单向热路径**：前端 → Wasm 位置数组走零拷贝；Wasm → 前端碰撞结果也走零拷贝。指令下发（AI JSON）走普通字符串 —— 指令一帧只有一条，零拷贝无收益
- **Profiler 数据双向汇聚**：Wasm 上报 BVH 耗时/GJK 次数，前端上报 FPS/DrawCall，在 Profiler store 合并
- **全链路无远程网络通信**：前端 ↔ Ollama 走 `localhost:11434`；前端 ↔ Wasm 走进程内 WebAssembly 线性内存。不存在 HTTP/3 或广域网优化需求

### 3.4 多物体消歧机制

当用户指令指向的场景物体有多个实例时，采用"AI + 前端交互"两级消歧：

1. **AI 层**：场景物体列表动态注入 User Prompt，模型看到所有物体。若存在多个匹配，输出 `query_user` 而非猜测
2. **前端层**：收到 `query_user` 后，在 3D 场景中高亮候选物体，弹出选项面板让用户点选
3. **闭环**：用户选择后组装为明确指令送入 Wasm

示例：
```
用户: "移动到桌子旁"（场景有 table_01 和 table_02）
→ AI: {"action":"query_user","target_object":"table","candidates":[
    {"id":"table_01","desc":"靠墙的木质长桌","position":[3.2,0,1.5]},
    {"id":"table_02","desc":"角落的圆形餐桌","position":[-1.0,0,-2.3]}
  ]}
→ 前端弹窗：A: 靠墙木质长桌  |  B: 角落圆形餐桌
→ 用户点 A → 组装 move_to table_01 → Wasm 执行
```

---

## 四、AI Prompt 设计（Plan B）

### 4.1 System Prompt（最终版）

```text
你是空间指令解析器。只输出一个 JSON 对象，禁止任何解释、Markdown、代码块标记。

【action 类型】
- move_to: target=[x,y,z], avoid_tags=["tag1","tag2"]
- pick_up: object_id="物体id"
- place_down: target=[x,y,z]
- follow_path: waypoints=[[x1,y1,z1],[x2,y2,z2],...]
- query_user: target_object="物体类别", candidates=[{id,desc,position}]
- stop: reason="user_request"
- query: target="position"|"is_colliding", object_id="物体id"
- unknown: message="原因"

【规则】
- 坐标范围 x,z∈[-10,10], y∈[0,2]
- 如果用户提到的物体在场景中存在多个实例，输出 query_user 让用户选择
- 如果指令模糊无法确定具体操作，输出 unknown
- 如果用户一句话包含多个操作，输出 unknown 提示一次只做一个
- 如果用户说"停"/"停下"/"别动"，输出 stop
- avoid_tags 默认包含 "static_obstacle"

【示例】
→ 移动到桌子旁，避开椅子
← {"action":"move_to","target":[3.2,0,1.5],"avoid_tags":["table","chair"]}

→ 拿起蓝色花瓶
← {"action":"pick_up","object_id":"blue_vase"}

→ 停下
← {"action":"stop","reason":"user_request"}

→ 往那边挪一点
← {"action":"unknown","message":"指令模糊，无法确定具体目标位置"}

→ 拿起杯子然后放到桌子上
← {"action":"unknown","message":"请一次只说一个操作"}

→ 带我去月球
← {"action":"unknown","message":"目标超出场景范围"}

当前场景物体：
{{SCENE_OBJECTS}}
```

### 4.2 调用参数

```typescript
{
  model: "qwen3.5:9b",
  system: SYSTEM_PROMPT,      // {{SCENE_OBJECTS}} 已替换为实际物体列表
  prompt: userInput,           // 用户自然语言原文
  stream: false,
  options: {
    temperature: 0.1,
    top_p: 0.9,
    stop: ["\n\n", "\n", "```"]
  }
}
```

### 4.3 与原版对比

| 优化点 | 原版 | Plan B |
|--------|------|--------|
| System Prompt 长度 | ~60 行 | ~35 行（含示例） |
| 身份描述 | 含"你是服务于 AetherMesh Engine..." | 砍掉，只留格式规则 |
| 多物体歧义 | 无处理 | 新增 `query_user` + 场景物体列表注入 |
| 紧急停止 | 无 | 新增 `stop` action |
| 多操作复合 | 无处理 | `unknown` 明确拒绝 |
| 模糊指令示例 | 仅"飞出场景" | 补充"往那边挪一点"和"多操作" |
| 坐标判断 | 模型判断是否越界 | 由前端校验层判断 |

### 4.4 完整 Action 清单（8 个）

| action | 用途 | 示例输入 |
|--------|------|---------|
| `move_to` | 移动到目标点 | "去桌子那边" |
| `pick_up` | 拾取物体 | "拿起红杯子" |
| `place_down` | 放置物体 | "放在(1,0,2)" |
| `follow_path` | 沿路径移动 | "沿着这三个点走" |
| `query_user` | 多物体消歧 | "桌子旁"(有3张桌子) |
| `stop` | 紧急停止 | "停下!" |
| `query` | 状态查询 | "机器人在哪" |
| `unknown` | 无法解析 | "飞起来" |

---

## 五、错误处理与测试

### 5.1 分层错误处理

每一层只处理自己管得到的错误。

**AI 层**：

| 错误场景 | 处理 |
|---------|------|
| Ollama 服务不可达 | 3 次重试（间隔 200ms/500ms/1000ms）→ 仍失败 → 降级为 mock AI |
| 模型返回非 JSON | `JSON.parse` 失败 → 正则提取第一个 `{...}` → 再失败 → 重试（最多 2 次） |
| JSON 校验不通过 | action 不在白名单 / 参数缺失 / 类型错误 → 重试 → 仍不通过 → 返回 `unknown` |
| 模型返回 `unknown` | 正常透传，前端展示 message 给用户 |
| 模型返回 `query_user` | 正常透传，前端渲染选项面板 |

**表现层状态机**：

```
                    ┌─────────────────┐
    指令到达  →     │    校验指令      │
                    └──────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         格式合法       query_user    格式非法
              │            │            │
              ▼            ▼            ▼
         送入 Wasm     弹出选项面板    提示用户重试
              │        等用户点选        │
              ▼            │            │
         Wasm 返回  ←─────┘            │
              │                         │
         ┌────┼────┐                    │
         ▼    ▼    ▼                    │
      无碰撞 碰撞  内核异常               │
         │    │    │                    │
         ▼    ▼    ▼                    │
      执行   回退  降级到                │
      移动   报警  mock 内核              │
```

**C++ Wasm 层**：

| 错误场景 | 处理 |
|---------|------|
| 内存池耗尽 | 返回错误码，不 crash；前端收到后降级 mock 内核 |
| 浮点精度导致 GJK 不收敛 | 迭代上限 64 次，超时返回"不确定"，前端按"碰撞"处理（偏安全） |
| BVH 树节点越界 | `assert` + 返回空碰撞对列表，前端日志记录 |
| 零拷贝指针越界 | Wasm 线性内存边界检查，越界拒绝操作 |

### 5.2 Mock/Real 切换

```typescript
// frontend/src/config.ts
export const ENGINE_CONFIG = {
  ai: {
    mode: 'real' as 'real' | 'mock',
    ollamaUrl: 'http://localhost:11434',
    model: 'qwen3.5:9b',
    retryCount: 2,
  },
  compute: {
    mode: 'real' as 'real' | 'mock',
    wasmPath: '/wasm/engine_core.js',
  },
};
```

开发时单独调某个模块切 mock，联调时切 real。不删代码，只改配置。

### 5.3 Sprint 验收门

| Sprint | 必验项 |
|--------|-------|
| S1 | 场景在 Chrome/Edge 打开，摄像机可旋转缩放，无 WebGL 报错 |
| S2 | 100 个立方体可见，FPS≥60，浏览器控制台无警告 |
| S3 | FPS/内存/DrawCall 数字变化真实（不是写死的） |
| S4 | 浏览器控制台打印 "Wasm: 2+3=5"，`emcc --version` 确认 |
| S5 | 传 10000 顶点 → C++ 翻转 Y 轴 → 回传 → 前端验证首尾各 5 个值正确 |
| S6 | 场景中可见 AABB 线框包围盒，BVH 遍历耗时显示在 Profiler |
| S7 | 拖动机器人方块靠近另一物体，碰撞时变红，分离时恢复 |
| S8 | 输入"移动到(1,0,2)"→ 控制台打印合法 JSON；输入"飞"→ 控制台打印 unknown |
| S9 | "移动到桌子旁" → 机器人移动 → 碰到东西回退 → 全过程 3D 可见 |
| S10 | README 按步骤可复现、24h 跑无内存泄漏（Chrome Task Manager 观察） |

### 5.4 关键边界场景

1. **物体完全重叠**：两个相同位置的立方体 → GJK 返回碰撞 + 穿透深度 → 前端回退逻辑按穿透方向推出去
2. **浮点精度截断**：物体距离 < 1e-7 时 GJK 可能震荡 → epsilon=1e-6，距离 < epsilon 一律按碰撞处理

---

## 六、项目目录结构

```
aethermesh-engine/
├── ai/
│   └── system_prompt.txt           # Plan B System Prompt（含 {{SCENE_OBJECTS}} 占位）
├── core/
│   ├── CMakeLists.txt
│   ├── include/
│   │   ├── bvh.h
│   │   ├── minkowski.h
│   │   └── engine_core.h
│   └── src/
│       ├── bvh.cpp
│       ├── minkowski.cpp
│       └── engine_core.cpp
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── config.ts              # Mock/Real 切换配置
│   │   ├── types.ts               # 全局类型定义
│   │   ├── stores/
│   │   │   └── simulationStore.ts # Pinia 状态管理
│   │   ├── components/
│   │   │   ├── Stage3D.vue
│   │   │   ├── ControlPanel.vue
│   │   │   └── Profiler.vue
│   │   └── utils/
│   │       ├── wasmLoader.ts
│   │       ├── ollamaClient.ts
│   │       └── mockKernel.ts      # JS mock 内核（暴力碰撞检测）
│   └── public/
│       └── wasm/                   # 编译产物（.wasm + .js）
├── build_wasm.sh
├── README.md
└── LICENSE
```

---

## 七、环境要求

| 工具 | 版本 | 状态 |
|------|------|------|
| Node.js | ≥18 | ✅ 22.17.1 |
| npm | ≥9 | ✅ 11.9.0 |
| CMake | ≥3.20 | ✅ 4.3.3 |
| Emscripten | ≥3.1.x | ✅ 6.0.0 |
| Ollama | ≥0.5.x | ✅ 0.30.5 |
| qwen3.5:9b | — | ✅ 已拉取 |
| GPU | 5070 Ti（可选，CPU亦可） | ✅ |
