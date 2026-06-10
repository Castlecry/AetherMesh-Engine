
---

## 🚀 AetherMesh Engine – 完整项目生成 Prompt（供 AI 编程助手使用）

### 项目名称
AetherMesh Engine – 端侧具身智能 3D 空间动态重建与避障模拟引擎

### 项目目标
在浏览器中实现零依赖、端侧高性能的 3D 空间仿真引擎，支持：
- 用户自然语言指令 → 本地 Ollama 大模型（Qwen3.5:9b）解析 → 标准化 JSON 指令
- C++ WebAssembly 内核执行 BVH 空间索引 + GJK 碰撞检测 + 路径规划
- Vue3 + Three.js 渲染 120FPS 3D 场景，并提供性能监控看板
- 完全离线可用，无后端服务器

### 技术栈与版本要求
- **前端**：Vue 3 (Composition API) + Vite + TypeScript + Three.js + TailwindCSS
- **AI 推理**：Ollama（本地），模型 `qwen3.5:9b`，强制 JSON 模式输出
- **核心计算**：Modern C++17/20，CMake，Emscripten 3.1.x，WebAssembly
- **通信**：Wasm 线性内存零拷贝映射（Emb直属 bind）
- **构建脚本**：bash（`build_wasm.sh`）一键编译 C++ → Wasm

### 生成要求（非常重要）
1. **完整工程结构**：必须严格按照项目计划书中的目录拓扑生成所有文件（包括 `CMakeLists.txt`、`package.json`、`vite.config.ts`、Vue 组件、C++ 源码等）。
2. **可运行性**：生成的代码应能在用户本地直接 `npm install && npm run dev` 后正常运行（假设 Ollama 已启动并加载了 qwen3.5:9b）。
3. **阶段性交付**：为了方便验证，请你按以下四个阶段依次生成代码，每个阶段完成后等待我的确认（或一次性生成全部，但注释标明阶段）。
   - 阶段一：前端渲染闭环（Vue3 + Three.js 基础场景 + 性能监控面板）
   - 阶段二：C++ Wasm 工程 + 零拷贝通信（简单的加法测试数据互通）
   - 阶段三：自研 BVH + GJK 碰撞算法（替换测试代码，完成真实几何计算）
   - 阶段四：AI 集成 + 完整闭环（Ollama 客户端 + Prompt 强约束 + 前端指令下发）
4. **代码风格与注释**：关键算法（BVH 构建、遍历、GJK）必须有详细注释，说明原理；前端组件使用 `<script setup lang="ts">`。
5. **边界情况处理**：包括内存泄漏检测、浮点精度容错、AI 输出 JSON 校验与重试。
6. **不要依赖外部重型物理引擎**（如 Bullet、PhysX），所有几何算法自实现。

### 具体实现细节（按计划书摘录）

#### 阶段一：前端渲染闭环（4 周工作量）
- `frontend/src/components/Stage3D.vue`：
  - 使用 `THREE.Scene`、`PerspectiveCamera`、`WebGLRenderer`，开启阴影和抗锯齿。
  - 实现 `InstancedMesh` 批量渲染 1000+ 个立方体或球体。
  - 每帧接收 Wasm 传递的物体位置数组（先模拟假数据）并更新矩阵。
  - 显示 FPS、DrawCall、内存占用（使用 `stats.js` 或自定义 Profiler）。
- `frontend/src/components/ControlPanel.vue`：
  - 输入框 + 发送按钮，显示 AI 返回的 JSON 指令（阶段一先 mock AI 返回固定 JSON）。
  - 显示机器人当前状态（空闲/移动/碰撞）。
- `frontend/src/components/Profiler.vue`：
  - 使用 `Chart.js` 或原生 Canvas 展示实时性能曲线（帧耗时、BVH 遍历时间等）。
- 确保 60FPS+。

#### 阶段二：C++ Wasm 工程与零拷贝通信
- `core/include/engine_core.h`：
  - 声明 `class EngineCore`，包含 `init()`, `updatePositions(float* positions, int count)`, `testCollision()` 等。
  - 内存管理：预分配线性内存池，避免动态分配。
- `core/src/engine_core.cpp`：
  - 实现 Embind 绑定，暴露 `EngineCore` 类给 JavaScript。
  - 实现零拷贝：前端通过 `Module.HEAPF32.subarray(ptr, ptr+size)` 直接读写 C++ 数组。
- `build_wasm.sh`：
  - 使用 `emcmake cmake .. && make`，编译参数 `-O3 -flto -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME=createAetherModule`。
- 前端 `wasmLoader.ts`：
  - 异步加载生成的 `.js` 和 `.wasm` 文件，实例化 `EngineCore`。
  - 提供 `getPositionArray()` 等辅助函数，映射指针到 Float32Array。

#### 阶段三：自研 BVH + GJK 碰撞检测
- `core/include/bvh.h`：
  - 实现 AABB 结构体，SAH 构建函数，`traverse` 遍历返回潜在碰撞对。
- `core/include/minkowski.h`：
  - 实现 GJK 算法检测两个凸多面体是否碰撞，支持 EPA 计算穿透深度（可选）。
- `core/src/engine_core.cpp` 中集成：
  - 场景物体列表存储为 `std::vector<Mesh>`，每个网格包含顶点数组和 AABB。
  - 每帧调用 `bvh->traverse` 获取碰撞对，再用 GJK 精细检测。
  - 返回碰撞结果给前端（通过零拷贝指针）。
- 处理浮点精度误差：自定义 `epsilon = 1e-6`，修正环绕方向错误（重排顶点索引顺序为逆时针）。

#### 阶段四：AI 集成与完整闭环
- `frontend/src/utils/ollamaClient.ts`：
  - 封装 `fetch` 调用 `http://localhost:11434/api/generate`，使用 `system_prompt.txt` 内容。
  - 强制 `temperature=0.1`, `stop=["```", "\n\n"]`，不流式输出。
  - 返回解析后的 JSON 对象。
- `ai/system_prompt.txt`：
  - 内容即我上面提供的 System Prompt（强约束 JSON 输出，Few-shot 示例）。
- `frontend/src/components/ControlPanel.vue` 逻辑：
  - 用户输入 → 调用 `ollamaClient.parse()` → 得到指令 JSON。
  - JSON 校验（使用 `ajv` 或手写）→ 通过后调用 Wasm 的 `executeInstruction(json)` 方法。
  - C++ 端 `executeInstruction` 解析 JSON（用 `std::string` 传入，或用结构体绑定），执行移动/拾取等，并触发重新渲染。
- 渲染闭环：C++ 更新所有物体的世界变换矩阵 → 通过零拷贝回传位置数组 → Three.js 批量更新 `InstancedMesh` 矩阵。

### 额外必须包含的文件
- `README.md`：项目简介、环境配置（Node.js 18+, CMake 3.20+, Emscripten 3.1.+, Ollama）、启动步骤。
- `LICENSE`：MIT 或 GPL-3.0。
- `.gitignore`：忽略 `node_modules`, `dist`, `build`, `*.wasm`, `*.js`（生成的文件应放在 `core/build/` 或 `frontend/public/wasm/` 下）。
- `core/CMakeLists.txt`：包含 `add_executable` 或 `add_library`，以及 Emscripten 特定设置（`EMSCRIPTEN` 宏）。
- `frontend/vite.config.ts`：配置 `optimizeDeps.exclude` 避免处理 Wasm，配置静态资源目录指向 `core/build` 生成的产物。

### 验收标准（交付前必须满足）
- [ ] 执行 `./build_wasm.sh` 能成功生成 `.wasm` 和对应的胶水 `.js`。
- [ ] `npm run dev` 启动后，浏览器中显示 3D 场景，至少有 100 个随机立方体。
- [ ] 控制台无内存泄漏报错，FPS 稳定在 60+。
- [ ] 在 AI 输入框输入“移动到 (1,0,1)”，能看到机器人（一个特殊颜色的立方体）平滑移动到目标点，且与其它立方体发生碰撞时自动停止或绕行（简单的避障逻辑可以先基于 GJK 返回的碰撞标志来实现位置回退）。
- [ ] Profiler 面板实时更新 BVH 遍历耗时（即使阶段一先用模拟数据）。
- [ ] 代码符合现代 C++17 规范，无裸指针（使用 `std::unique_ptr`），无全局状态。

### 开始生成
请从现在开始，**按阶段一、二、三、四的顺序**生成完整代码。我会在每个阶段结束后检查并要求你继续。如果你能一次性生成全部四个阶段，也请用注释标明每个文件的所属阶段。

---

**你可以将此 Prompt 完整发送给 CloudCode（或 Cursor / Copilot 等），AI 会据此生成整个项目。** 如果生成过程中遇到上下文长度限制，可以要求 AI 分阶段输出，每个阶段只产出该阶段的文件。