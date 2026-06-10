#include "engine_core.h"
#include <emscripten/bind.h>
#include <cstring>
#include <chrono>

using namespace emscripten;

EngineCore::EngineCore() : vertexBuffer(nullptr), vertexCount(0), traversalTime(0.0f) {}

EngineCore::~EngineCore() { dispose(); }

void EngineCore::init(int objectCount) {
  vertexCount = objectCount * 27;
  vertexBuffer = new float[vertexCount]();
}

uintptr_t EngineCore::processVertices(uintptr_t dataPtr, int count) {
  if (!vertexBuffer) return 0;

  float* input = reinterpret_cast<float*>(dataPtr);

  int floatsToProcess = count * 3;
  for (int i = 0; i < floatsToProcess && i < vertexCount; i += 3) {
    vertexBuffer[i]     = input[i];
    vertexBuffer[i + 1] = -input[i + 1];
    vertexBuffer[i + 2] = input[i + 2];
  }

  return reinterpret_cast<uintptr_t>(vertexBuffer);
}

// === BVH Operations (Sprint 6) ===

void EngineCore::buildBVH(uintptr_t aabbDataPtr, int count) {
  float* aabbData = reinterpret_cast<float*>(aabbDataPtr);
  bvh = std::make_unique<BVHTree>();
  std::vector<Primitive> primitives(count);

  for (int i = 0; i < count; i++) {
    int off = i * 6;
    primitives[i].bounds = {
      aabbData[off], aabbData[off + 1], aabbData[off + 2],
      aabbData[off + 3], aabbData[off + 4], aabbData[off + 5]
    };
    primitives[i].objectIndex = i;
    primitives[i].centroidX = (aabbData[off] + aabbData[off + 3]) * 0.5f;
    primitives[i].centroidY = (aabbData[off + 1] + aabbData[off + 4]) * 0.5f;
    primitives[i].centroidZ = (aabbData[off + 2] + aabbData[off + 5]) * 0.5f;
  }

  bvh->build(primitives);

  // Build visualization data: 6 floats per node
  const auto& nodes = bvh->getNodes();
  bvhNodeData.clear();
  bvhNodeData.reserve(nodes.size() * 6);
  for (const auto& node : nodes) {
    bvhNodeData.push_back(node.bounds.minX);
    bvhNodeData.push_back(node.bounds.minY);
    bvhNodeData.push_back(node.bounds.minZ);
    bvhNodeData.push_back(node.bounds.maxX);
    bvhNodeData.push_back(node.bounds.maxY);
    bvhNodeData.push_back(node.bounds.maxZ);
  }
}

int EngineCore::traverseBVH(float minX, float minY, float minZ,
                             float maxX, float maxY, float maxZ) {
  if (!bvh) return 0;
  AABB query = {minX, minY, minZ, maxX, maxY, maxZ};
  std::vector<int> results;

  auto start = std::chrono::high_resolution_clock::now();
  bvh->traverse(query, results);
  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<float, std::milli> elapsed = end - start;
  traversalTime = elapsed.count();

  return static_cast<int>(results.size());
}

int EngineCore::getBVHNodeCount() {
  return bvh ? bvh->getNodeCount() : 0;
}

uintptr_t EngineCore::getBVHNodeData() {
  if (bvhNodeData.empty()) return 0;
  return reinterpret_cast<uintptr_t>(bvhNodeData.data());
}

// === Collision Detection (Sprint 7 stub) ===

void EngineCore::detectCollisions(uintptr_t /*aabbDataPtr*/, int /*objectCount*/, int /*robotIndex*/) {
  // Implemented in Sprint 7 with GJK
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
  bvhNodeData.clear();
  bvh.reset();
}

EMSCRIPTEN_BINDINGS(aethermesh_core) {
  class_<EngineCore>("EngineCore")
    .constructor<>()
    .function("init", &EngineCore::init)
    .function("processVertices", &EngineCore::processVertices)
    .function("buildBVH", &EngineCore::buildBVH)
    .function("traverseBVH", &EngineCore::traverseBVH)
    .function("getBVHNodeCount", &EngineCore::getBVHNodeCount)
    .function("getBVHNodeData", &EngineCore::getBVHNodeData)
    .function("detectCollisions", &EngineCore::detectCollisions)
    .function("getCollisionCount", &EngineCore::getCollisionCount)
    .function("getCollisionData", &EngineCore::getCollisionData)
    .function("getTraversalTime", &EngineCore::getTraversalTime)
    .function("dispose", &EngineCore::dispose)
  ;
}
