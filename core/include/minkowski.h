#pragma once
#include <vector>
#include <cmath>

struct Vec3 {
  float x, y, z;

  Vec3() : x(0), y(0), z(0) {}
  Vec3(float _x, float _y, float _z) : x(_x), y(_y), z(_z) {}

  Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
  Vec3 operator-() const { return {-x, -y, -z}; }
  float dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  Vec3 cross(const Vec3& o) const {
    return {y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x};
  }
  float lengthSq() const { return x * x + y * y + z * z; }
  float length() const { return std::sqrt(lengthSq()); }
  Vec3 normalized() const {
    float len = length();
    if (len < 1e-10f) return {0, 1, 0};
    return {x / len, y / len, z / len};
  }
};

inline Vec3 operator*(float s, const Vec3& v) { return v * s; }

Vec3 supportPoint(const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB, const Vec3& dir);
bool gjkIntersect(
  const std::vector<Vec3>& shapeA, const std::vector<Vec3>& shapeB,
  float& outPenetration, Vec3& outContactPoint
);
