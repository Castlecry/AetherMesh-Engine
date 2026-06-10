cmake_minimum_required(VERSION 3.20)
project(aethermesh_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(engine_core src/engine_core.cpp)
target_include_directories(engine_core PRIVATE include)

if(EMSCRIPTEN)
  target_compile_options(engine_core PRIVATE -O3 -flto)
  target_link_options(engine_core PRIVATE
    -O3
    -flto
    -sWASM=1
    -sMODULARIZE=1
    "-sEXPORT_NAME=createAetherModule"
    -sALLOW_MEMORY_GROWTH=1
    "-sINITIAL_MEMORY=268435456"
    "-sMAXIMUM_MEMORY=1073741824"
    --bind
    "--pre-js=${CMAKE_CURRENT_SOURCE_DIR}/src/pre.js"
  )
endif()
