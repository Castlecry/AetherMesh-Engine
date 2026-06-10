# AetherMesh Engine

端侧具身智能 3D 空间动态重建与避障模拟引擎

浏览器运行、零重型环境依赖的轻量化具身智能空间仿真沙箱。

## 技术栈

- **前端**: Vue 3 + Vite + TypeScript + Three.js + Pinia
- **计算内核**: Modern C++17 + Emscripten → WebAssembly
- **AI 推理**: Ollama + qwen3.5:9b (本地)

## 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | ≥18 |
| CMake | ≥3.20 |
| Emscripten | ≥3.1.x |
| Ollama | ≥0.5.x |

## 快速开始

### 1. 安装前端依赖

```bash
cd frontend
npm install
```

### 2. 编译 Wasm 内核

```bash
bash build_wasm.sh
```

### 3. 启动 Ollama（确保已拉取模型）

```bash
ollama serve
ollama pull qwen3.5:9b
```

### 4. 启动开发服务器

```bash
cd frontend
npm run dev
```

打开 http://localhost:3000

### 5. 使用

- 鼠标拖拽旋转视角，滚轮缩放
- 右侧面板输入自然语言指令
- 左下角查看实时性能指标

## 配置

编辑 `frontend/src/config.ts` 切换 Mock/Real 模式：

```typescript
export const ENGINE_CONFIG = {
  ai: { mode: 'mock' },     // 'real' 需要 Ollama 运行
  compute: { mode: 'mock' }, // 'real' 需要先编译 Wasm
}
```

## 项目结构

```
aethermesh-engine/
├── ai/                  # AI 提示词
├── core/                # C++ Wasm 计算内核
│   ├── include/         # 头文件
│   └── src/             # 源码
├── frontend/            # Vue3 前端
│   └── src/
│       ├── components/  # Stage3D, ControlPanel, Profiler
│       ├── stores/      # Pinia 状态管理
│       └── utils/       # wasmLoader, ollamaClient, mockKernel
├── docs/                # 设计与实施方案文档
└── build_wasm.sh        # Wasm 编译脚本
```

## License

MIT
