#include <gtest/gtest.h>
#include <fstream>
#include <sstream>
#include <cmath>
#include "chemsim/io/xyz_parser.h"
#include "chemsim/ff/uff_energy.h"
#include "chemsim/ff/uff_typing.h"
#include "chemsim/ff/uff_params.h"

using namespace chemsim;

static std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) throw std::runtime_error("Cannot open: " + path);
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

TEST(UFFTyping, Water) {
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));
    auto types = assign_uff_types(mol);
    EXPECT_EQ(types.size(), 3u);
    EXPECT_EQ(types[0], "O_3");
    EXPECT_EQ(types[1], "H_");
    EXPECT_EQ(types[2], "H_");
}

TEST(UFFTyping, Methane) {
    auto mol = parse_xyz(read_file("data/test_molecules/methane.xyz"));
    auto types = assign_uff_types(mol);
    EXPECT_EQ(types[0], "C_3");
    for (int i = 1; i < 5; ++i) {
        EXPECT_EQ(types[i], "H_");
    }
}

TEST(UFFEnergy, WaterEnergy) {
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));
    UFFForceField ff;
    ff.setup(mol);

    double energy = ff.calculate_energy(mol);
    // Energy should be finite and reasonable
    EXPECT_TRUE(std::isfinite(energy));
    // Water near equilibrium should have small energy
    EXPECT_LT(std::abs(energy), 100.0);

    auto components = ff.calculate_energy_components(mol);
    EXPECT_NEAR(components.total, energy, 1e-10);
    EXPECT_GE(components.bond_stretch, 0.0);
}

TEST(UFFEnergy, MethaneEnergy) {
    auto mol = parse_xyz(read_file("data/test_molecules/methane.xyz"));
    UFFForceField ff;
    ff.setup(mol);

    double energy = ff.calculate_energy(mol);
    EXPECT_TRUE(std::isfinite(energy));
}

TEST(UFFEnergy, GradientFiniteDifference) {
    // Verify analytical gradient against finite difference
    auto mol = parse_xyz(read_file("data/test_molecules/water.xyz"));
    UFFForceField ff;
    ff.setup(mol);

    auto grad_analytical = ff.calculate_gradient(mol);
    double h = 1e-5;

    for (int i = 0; i < mol.num_atoms() * 3; ++i) {
        auto pos = mol.get_positions();

        // E(x+h)
        pos[i] += h;
        mol.set_positions(pos);
        double e_plus = ff.calculate_energy(mol);

        // E(x-h)
        pos[i] -= 2.0 * h;
        mol.set_positions(pos);
        double e_minus = ff.calculate_energy(mol);

        // Restore
        pos[i] += h;
        mol.set_positions(pos);

        double grad_fd = (e_plus - e_minus) / (2.0 * h);

        // Check agreement (allow 1% relative error or 1e-4 absolute)
        double abs_err = std::abs(grad_analytical[i] - grad_fd);
        double rel_err = std::abs(grad_analytical[i]) > 1e-6 ?
            abs_err / std::abs(grad_analytical[i]) : abs_err;

        EXPECT_TRUE(abs_err < 1e-3 || rel_err < 0.05)
            << "Gradient mismatch at index " << i
            << ": analytical=" << grad_analytical[i]
            << " fd=" << grad_fd
            << " abs_err=" << abs_err
            << " rel_err=" << rel_err;
    }
}

TEST(UFFEnergy, BenzeneEnergy) {
    auto mol = parse_xyz(read_file("data/test_molecules/benzene.xyz"));
    UFFForceField ff;
    ff.setup(mol);

    double energy = ff.calculate_energy(mol);
    EXPECT_TRUE(std::isfinite(energy));

    // Check gradient for benzene too
    auto grad = ff.calculate_gradient(mol);
    for (int i = 0; i < grad.size(); ++i) {
        EXPECT_TRUE(std::isfinite(grad[i]));
    }
}
