#include "bvh.h"
#include <cfloat>
#include <cstring>
#include <chrono>

static const int MAX_DEPTH = 32;
static const int LEAF_SIZE = 4;

BVHTree::BVHTree() : nodeCount(0) {}

void BVHTree::build(const std::vector<Primitive>& p) {
  prims = p;
  nodes.clear();
  nodes.reserve(prims.size() * 2);
  nodeCount = 0;
  nodes.push_back({});
  buildRecursive(0, static_cast<int>(prims.size()), 0);
}

int BVHTree::buildRecursive(int first, int count, int depth) {
  int nodeIdx = nodeCount++;

  // Compute bounding box of all primitives in this range
  AABB bounds = prims[first].bounds;
  for (int i = 1; i < count; i++) {
    bounds = AABB::merge(bounds, prims[first + i].bounds);
  }
  nodes[nodeIdx].bounds = bounds;

  // Leaf condition
  if (count <= LEAF_SIZE || depth >= MAX_DEPTH) {
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  // Find best split using SAH
  int bestAxis = 0;
  float bestPos = 0.0f;
  float bestCost = findBestSplit(first, count, bestAxis, bestPos);

  // SAH no-split cost
  float noSplitCost = static_cast<float>(count) * bounds.surfaceArea();
  if (bestCost >= noSplitCost) {
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  // Partition primitives around split plane
  auto mid = std::partition(prims.begin() + first, prims.begin() + first + count,
    [bestAxis, bestPos](const Primitive& p) {
      float c = (bestAxis == 0) ? p.centroidX : ((bestAxis == 1) ? p.centroidY : p.centroidZ);
      return c < bestPos;
    });

  int midIdx = static_cast<int>(std::distance(prims.begin() + first, mid));
  if (midIdx == 0 || midIdx == count) {
    nodes[nodeIdx].firstPrim = first;
    nodes[nodeIdx].primCount = count;
    nodes[nodeIdx].leftChild = -1;
    nodes[nodeIdx].rightChild = -1;
    return nodeIdx;
  }

  nodes[nodeIdx].splitAxis = bestAxis;
  nodes[nodeIdx].firstPrim = 0;
  nodes[nodeIdx].primCount = 0;

  nodes.push_back({});
  nodes.push_back({});

  nodes[nodeIdx].leftChild = buildRecursive(first, midIdx, depth + 1);
  nodes[nodeIdx].rightChild = buildRecursive(first + midIdx, count - midIdx, depth + 1);

  return nodeIdx;
}

float BVHTree::findBestSplit(int first, int count, int& outAxis, float& outSplitPos) {
  float bestCost = FLT_MAX;
  const int BUCKETS = 12;

  for (int axis = 0; axis < 3; axis++) {
    float boundMin, boundMax;
    if (axis == 0) { boundMin = nodes[nodeCount].bounds.minX; boundMax = nodes[nodeCount].bounds.maxX; }
    else if (axis == 1) { boundMin = nodes[nodeCount].bounds.minY; boundMax = nodes[nodeCount].bounds.maxY; }
    else { boundMin = nodes[nodeCount].bounds.minZ; boundMax = nodes[nodeCount].bounds.maxZ; }

    if (boundMax - boundMin < 1e-6f) continue;

    for (int bucket = 1; bucket < BUCKETS; bucket++) {
      float splitPos = boundMin + (float(bucket) / BUCKETS) * (boundMax - boundMin);

      AABB leftBounds = {FLT_MAX, FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX, -FLT_MAX};
      AABB rightBounds = {FLT_MAX, FLT_MAX, FLT_MAX, -FLT_MAX, -FLT_MAX, -FLT_MAX};
      int leftCount = 0, rightCount = 0;

      for (int i = 0; i < count; i++) {
        const auto& p = prims[first + i];
        float centroid = (axis == 0) ? p.centroidX : ((axis == 1) ? p.centroidY : p.centroidZ);
        if (centroid < splitPos) {
          leftBounds = AABB::merge(leftBounds, p.bounds);
          leftCount++;
        } else {
          rightBounds = AABB::merge(rightBounds, p.bounds);
          rightCount++;
        }
      }

      if (leftCount == 0 || rightCount == 0) continue;

      float totalArea = nodes[nodeCount].bounds.surfaceArea();
      if (totalArea < 1e-10f) continue;

      float cost = 1.0f + (leftBounds.surfaceArea() / totalArea) * leftCount
                        + (rightBounds.surfaceArea() / totalArea) * rightCount;

      if (cost < bestCost) {
        bestCost = cost;
        outAxis = axis;
        outSplitPos = splitPos;
      }
    }
  }

  return bestCost;
}

void BVHTree::traverse(const AABB& query, std::vector<int>& outCollisions) const {
  std::vector<int> stack;
  stack.reserve(64);
  stack.push_back(0);

  while (!stack.empty()) {
    int idx = stack.back();
    stack.pop_back();

    const BVHNode& node = nodes[idx];

    // Quick AABB overlap test
    if (query.minX > node.bounds.maxX || query.maxX < node.bounds.minX ||
        query.minY > node.bounds.maxY || query.maxY < node.bounds.minY ||
        query.minZ > node.bounds.maxZ || query.maxZ < node.bounds.minZ) {
      continue;
    }

    if (node.leftChild == -1) {
      // Leaf node — report all primitives with precise overlap
      for (int i = 0; i < node.primCount; i++) {
        const Primitive& p = prims[node.firstPrim + i];
        if (query.minX <= p.bounds.maxX && query.maxX >= p.bounds.minX &&
            query.minY <= p.bounds.maxY && query.maxY >= p.bounds.minY &&
            query.minZ <= p.bounds.maxZ && query.maxZ >= p.bounds.minZ) {
          outCollisions.push_back(p.objectIndex);
        }
      }
    } else {
      stack.push_back(node.rightChild);
      stack.push_back(node.leftChild);
    }
  }
}
