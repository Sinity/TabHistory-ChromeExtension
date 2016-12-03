project(Stay_Productive)
cmake_minimum_required(VERSION 2.8)

#build type
set(CMAKE_BUILD_TYPE "Debug")
#set(CMAKE_BUILD_TYPE "Release")

#flags
add_definitions(-std=c++14 -Wall -Wextra -m64)

#libs
#include_directories(SYSTEM D:/libs/boost)

#project files and include pathes
include_directories(.)
file(GLOB_RECURSE SRCS "src/*.cpp")

#build library
add_executable(stay_productive ${SRCS})
