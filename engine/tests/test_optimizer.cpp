#include <gtest/gtest.h>
#include <fstream>
#include <sstream>
#include <cmath>
#include "chemsim/io/xyz_parser.h"
#include "chemsim/ff/uff_energy.h"
#include "chemsim/opt/optimizer.h"

using namespace chemsim;

static std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) throw std::runtime_error("Cannot open: " + path);
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

TEST(Optimizer, SteepestDescentWater) {
    // Distort water and optimize
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));

    // Distort positions slightly
    mol.atom(1).position += Eigen::Vector3d(0.1, 0.1, 0.0);
    mol.atom(2).position -= Eigen::Vector3d(0.05, 0.1, 0.0);

    UFFForceField ff;
    ff.setup(mol);

    double initial_energy = ff.calculate_energy(mol);

    OptSettings settings;
    settings.method = "steepest_descent";
    settings.max_iterations = 200;
    settings.grad_tolerance = 1e-3;

    auto result = optimize_geometry(mol, ff, settings);

    EXPECT_LT(result.final_energy, initial_energy);
    EXPECT_GT(result.trajectory.size(), 0u);
}

TEST(Optimizer, LBFGSWater) {
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));

    // Distort
    mol.atom(1).position += Eigen::Vector3d(0.15, 0.05, 0.0);

    UFFForceField ff;
    ff.setup(mol);

    double initial_energy = ff.calculate_energy(mol);

    OptSettings settings;
    settings.method = "lbfgs";
    settings.max_iterations = 200;

    auto result = optimize_geometry(mol, ff, settings);

    EXPECT_LT(result.final_energy, initial_energy);
    EXPECT_TRUE(result.converged);
}

TEST(Optimizer, LBFGSMethane) {
    auto mol = parse_xyz(read_file("data/test_molecules/methane.xyz"));

    // Distort methane
    mol.atom(1).position += Eigen::Vector3d(0.2, 0.0, 0.0);
    mol.atom(2).position -= Eigen::Vector3d(0.0, 0.15, 0.0);

    UFFForceField ff;
    ff.setup(mol);

    double initial_energy = ff.calculate_energy(mol);

    OptSettings settings;
    settings.method = "lbfgs";
    settings.max_iterations = 500;

    auto result = optimize_geometry(mol, ff, settings);

    EXPECT_LT(result.final_energy, initial_energy);

    // Check C-H distances are reasonable (~1.09 A)
    for (int i = 1; i <= 4; ++i) {
        double dist = (mol.atom(0).position - mol.atom(i).position).norm();
        EXPECT_NEAR(dist, 1.09, 0.15);  // Within 0.15A of ideal
    }
}

TEST(Optimizer, Callback) {
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));
    mol.atom(1).position += Eigen::Vector3d(0.1, 0.0, 0.0);

    UFFForceField ff;
    ff.setup(mol);

    int callback_count = 0;
    auto callback = [&callback_count](const OptProgress& prog) {
        callback_count++;
        EXPECT_TRUE(std::isfinite(prog.energy));
    };

    OptSettings settings;
    settings.method = "steepest_descent";
    settings.max_iterations = 10;

    optimize_geometry(mol, ff, settings, callback);
    EXPECT_GT(callback_count, 0);
}
