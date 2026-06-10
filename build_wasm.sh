#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/core/build"
OUTPUT_DIR="$SCRIPT_DIR/frontend/public/wasm"

mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

cd "$BUILD_DIR"

# Configure with Emscripten
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
emmake make -j$(nproc 2>/dev/null || echo 4)

# Copy outputs to frontend
cp engine_core.js engine_core.wasm "$OUTPUT_DIR/" 2>/dev/null || true
cp engine_core.worker.js "$OUTPUT_DIR/" 2>/dev/null || true
cp engine_core.data "$OUTPUT_DIR/" 2>/dev/null || true

echo "Build complete. Wasm outputs copied to frontend/public/wasm/"
ls -la "$OUTPUT_DIR/"
