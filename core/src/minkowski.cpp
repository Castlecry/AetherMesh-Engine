#include "minkowski.h"
#include <algorithm>
#include <limits>

static const float GJK_EPSILON = 1e-6f;
static const int GJK_MAX_ITER = 64;

Vec3 supportPoint(const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB, const Vec3& dir) {
  float maxA = -std::numeric_limits<float>::max();
  Vec3 pointA;
  for (const auto& v : shapeA) {
    float d = v.dot(dir);
    if (d > maxA) { maxA = d; pointA = v; }
  }

  Vec3 negDir = -dir;
  float maxB = -std::numeric_limits<float>::max();
  Vec3 pointB;
  for (const auto& v : shapeB) {
    float d = v.dot(negDir);
    if (d > maxB) { maxB = d; pointB = v; }
  }

  return pointA - pointB;
}

bool gjkIntersect(
  const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB,
  float& outPenetration, Vec3& outContactPoint
) {
  outPenetration = 0.0f;
  outContactPoint = {0, 0, 0};

  // Initial direction: centroid of B to centroid of A
  Vec3 centerA(0,0,0), centerB(0,0,0);
  for (const auto& v : shapeA) centerA = centerA + v;
  for (const auto& v : shapeB) centerB = centerB + v;
  centerA = centerA * (1.0f / shapeA.size());
  centerB = centerB * (1.0f / shapeB.size());

  Vec3 dir = centerA - centerB;
  if (dir.lengthSq() < 1e-8f) dir = {1, 0, 0};

  // Simplex vertices (Minkowski difference points)
  std::vector<Vec3> simplex;
  simplex.push_back(supportPoint(shapeA, shapeB, dir));
  dir = -simplex[0];

  for (int iter = 0; iter < GJK_MAX_ITER; iter++) {
    Vec3 newPoint = supportPoint(shapeA, shapeB, dir);

    // Not past origin in search direction → no intersection
    if (newPoint.dot(dir) < 0) {
      return false;
    }

    simplex.push_back(newPoint);

    // Update simplex and search direction
    if (simplex.size() == 2) {
      Vec3 ab = simplex[1] - simplex[0];
      Vec3 ao = -simplex[0];
      if (ab.dot(ao) > 0) {
        dir = ab.cross(ao).cross(ab);
      } else {
        simplex.erase(simplex.begin());
        dir = ao;
      }
    } else if (simplex.size() == 3) {
      Vec3 a = simplex[2];
      Vec3 ab = simplex[1] - a;
      Vec3 ac = simplex[0] - a;
      Vec3 ao = -a;

      Vec3 abc = ab.cross(ac);
      Vec3 abPerp = ac.cross(abc);
      Vec3 acPerp = abc.cross(ab);

      if (abPerp.dot(ao) > 0) {
        simplex.erase(simplex.begin()); // Remove c
        dir = abPerp;
      } else if (acPerp.dot(ao) > 0) {
        simplex.erase(simplex.begin() + 1); // Remove b
        dir = acPerp;
      } else {
        if (abc.dot(ao) > 0) {
          dir = abc;
        } else {
          // Need 4th point
          dir = -abc;
        }
      }
    } else if (simplex.size() == 4) {
      // Tetrahedron — origin inside means collision
      bool originInside = true;
      for (int f = 0; f < 4; f++) {
        int i0 = f, i1 = (f+1)%4, i2 = (f+2)%4;
        Vec3 normal = (simplex[i1] - simplex[i0]).cross(simplex[i2] - simplex[i0]);
        if (normal.dot(-simplex[i0]) > 0) {
          // Origin outside face — continue
          simplex.erase(simplex.begin() + ((f+3)%4));
          dir = normal;
          originInside = false;
          break;
        }
      }
      if (originInside) {
        outPenetration = 0.01f;
        outContactPoint = (simplex[0] + simplex[1] + simplex[2] + simplex[3]) * 0.25f;
        return true;
      }
    }
  }

  // Max iterations → treat as collision (safety bias)
  outPenetration = 0.01f;
  return true;
}
