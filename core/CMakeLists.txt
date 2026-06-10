cmake_minimum_required(VERSION 3.20)
project(aethermesh_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(EMSCRIPTEN)
  set(CMAKE_EXECUTABLE_SUFFIX ".js")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -flto")
  set(CMAKE_EXECUTABLE_LINKER_FLAGS "${CMAKE_EXECUTABLE_LINKER_FLAGS} \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createAetherModule' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=256MB \
    -s MAXIMUM_MEMORY=1GB \
    --pre-js ${CMAKE_SOURCE_DIR}/../core/src/pre.js"
  )
endif()

add_executable(engine_core
  src/engine_core.cpp
)

include_directories(include)
