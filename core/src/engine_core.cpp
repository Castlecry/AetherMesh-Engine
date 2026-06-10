#include "engine_core.h"
#include <emscripten/bind.h>
#include <cstring>

using namespace emscripten;

EngineCore::EngineCore() : vertexBuffer(nullptr), vertexCount(0), traversalTime(0.0f) {}

EngineCore::~EngineCore() { dispose(); }

void EngineCore::init(int objectCount) {
  vertexCount = objectCount * 27; // 8 corners * 3 + 3 position per object
  vertexBuffer = new float[vertexCount]();
}

uintptr_t EngineCore::processVertices(uintptr_t dataPtr, int count) {
  if (!vertexBuffer) return 0;

  float* input = reinterpret_cast<float*>(dataPtr);

  int floatsToProcess = count * 3;
  for (int i = 0; i < floatsToProcess && i < vertexCount; i += 3) {
    vertexBuffer[i]     = input[i];       // X unchanged
    vertexBuffer[i + 1] = -input[i + 1];  // Y flipped (test transformation)
    vertexBuffer[i + 2] = input[i + 2];   // Z unchanged
  }

  return reinterpret_cast<uintptr_t>(vertexBuffer);
}

int EngineCore::getCollisionCount() {
  return static_cast<int>(collisions.size());
}

uintptr_t EngineCore::getCollisionData() {
  if (collisions.empty()) return 0;
  return reinterpret_cast<uintptr_t>(collisions.data());
}

float EngineCore::getTraversalTime() {
  return traversalTime;
}

void EngineCore::dispose() {
  if (vertexBuffer) {
    delete[] vertexBuffer;
    vertexBuffer = nullptr;
  }
  collisions.clear();
}

EMSCRIPTEN_BINDINGS(aethermesh_core) {
  class_<EngineCore>("EngineCore")
    .constructor<>()
    .function("init", &EngineCore::init)
    .function("processVertices", &EngineCore::processVertices)
    .function("getCollisionCount", &EngineCore::getCollisionCount)
    .function("getCollisionData", &EngineCore::getCollisionData)
    .function("getTraversalTime", &EngineCore::getTraversalTime)
    .function("dispose", &EngineCore::dispose)
  ;
}
