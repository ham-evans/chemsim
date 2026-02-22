cmake_minimum_required(VERSION 3.16)
project(chemsim_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Fetch Eigen
include(FetchContent)
FetchContent_Declare(
    eigen
    GIT_REPOSITORY https://gitlab.com/libeigen/eigen.git
    GIT_TAG 3.4.0
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(eigen)

# Fetch LBFGSpp
FetchContent_Declare(
    lbfgspp
    GIT_REPOSITORY https://github.com/yixuan/LBFGSpp.git
    GIT_TAG v0.3.0
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(lbfgspp)

# Core library
add_library(chemsim_core
    src/core/element_data.cpp
    src/core/molecule.cpp
    src/io/xyz_parser.cpp
    src/io/sdf_parser.cpp
    src/ff/uff_params.cpp
    src/ff/uff_typing.cpp
    src/ff/uff_energy.cpp
    src/opt/optimizer.cpp
)
target_include_directories(chemsim_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)
target_link_libraries(chemsim_core PUBLIC Eigen3::Eigen)
target_include_directories(chemsim_core PUBLIC
    ${lbfgspp_SOURCE_DIR}/include
)

# pybind11
find_package(pybind11 QUIET)
if(pybind11_FOUND)
    pybind11_add_module(chemsim_engine bindings/python/bindings.cpp)
    target_link_libraries(chemsim_engine PRIVATE chemsim_core)
else()
    message(STATUS "pybind11 not found, skipping Python bindings")
endif()

# Google Test
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
    FetchContent_Declare(
        googletest
        GIT_REPOSITORY https://github.com/google/googletest.git
        GIT_TAG v1.14.0
        GIT_SHALLOW TRUE
    )
    FetchContent_MakeAvailable(googletest)
    enable_testing()

    add_executable(chemsim_tests
        tests/test_element_data.cpp
        tests/test_molecule.cpp
        tests/test_xyz_parser.cpp
        tests/test_uff.cpp
        tests/test_optimizer.cpp
    )
    target_link_libraries(chemsim_tests PRIVATE chemsim_core GTest::gtest_main)
    target_include_directories(chemsim_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)

    include(GoogleTest)
    gtest_discover_tests(chemsim_tests WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
endif()
