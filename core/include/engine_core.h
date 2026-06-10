#pragma once
#include <cstdint>
#include <vector>

class EngineCore {
public:
  EngineCore();
  ~EngineCore();

  void init(int objectCount);

  // Process positions: takes a pointer into Wasm linear memory (zero-copy from JS Float32Array)
  // Returns pointer to the processed buffer for JS to read back
  uintptr_t processVertices(uintptr_t dataPtr, int count);

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
};
