#pragma once
#include <cstdint>
#include <vector>
#include <memory>
#include "bvh.h"

class EngineCore {
public:
  EngineCore();
  ~EngineCore();

  void init(int objectCount);

  // Zero-copy vertex processing
  uintptr_t processVertices(uintptr_t dataPtr, int count);

  // BVH operations (Sprint 6)
  void buildBVH(uintptr_t aabbDataPtr, int count);
  int traverseBVH(float minX, float minY, float minZ,
                   float maxX, float maxY, float maxZ);
  int getBVHNodeCount();
  uintptr_t getBVHNodeData();

  // Collision detection (Sprint 7)
  void detectCollisions(uintptr_t aabbDataPtr, int objectCount, int robotIndex);
  int getCollisionCount();
  uintptr_t getCollisionData();

  float getTraversalTime();
  void dispose();

private:
  float* vertexBuffer;
  int vertexCount;
  float traversalTime;

  struct CollisionResult {
    int objectA;
    int objectB;
    float penetration;
    float contactX, contactY, contactZ;
  };
  std::vector<CollisionResult> collisions;

  std::unique_ptr<BVHTree> bvh;
  std::vector<float> bvhNodeData;
};
