#pragma once
#include <vector>
#include <memory>
#include <algorithm>
#include <limits>

struct AABB {
  float minX, minY, minZ;
  float maxX, maxY, maxZ;

  float surfaceArea() const {
    float dx = maxX - minX;
    float dy = maxY - minY;
    float dz = maxZ - minZ;
    return 2.0f * (dx * dy + dy * dz + dz * dx);
  }

  static AABB merge(const AABB& a, const AABB& b) {
    return {
      std::min(a.minX, b.minX), std::min(a.minY, b.minY), std::min(a.minZ, b.minZ),
      std::max(a.maxX, b.maxX), std::max(a.maxY, b.maxY), std::max(a.maxZ, b.maxZ)
    };
  }
};

struct BVHNode {
  AABB bounds;
  int leftChild;
  int rightChild;
  int firstPrim;
  int primCount;
  int splitAxis;
};

struct Primitive {
  AABB bounds;
  int objectIndex;
  float centroidX, centroidY, centroidZ;
};

class BVHTree {
public:
  BVHTree();

  void build(const std::vector<Primitive>& primitives);
  void traverse(const AABB& query, std::vector<int>& outCollisions) const;
  const std::vector<BVHNode>& getNodes() const { return nodes; }
  int getNodeCount() const { return nodeCount; }

private:
  std::vector<BVHNode> nodes;
  std::vector<Primitive> prims;
  int nodeCount;

  int buildRecursive(int first, int count, int depth);
  float findBestSplit(int first, int count, int& outAxis, float& outSplitPos);
};
