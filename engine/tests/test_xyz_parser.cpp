#include <gtest/gtest.h>
#include <fstream>
#include <sstream>
#include "chemsim/io/xyz_parser.h"

using namespace chemsim;

static std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) throw std::runtime_error("Cannot open: " + path);
    std::ostringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

TEST(XYZParser, ParseWater) {
    std::string xyz = read_file("data/test_molecules/water.xyz");
    auto mol = parse_xyz(xyz);

    EXPECT_EQ(mol.num_atoms(), 3);
    EXPECT_EQ(mol.atom(0).symbol, "O");
    EXPECT_EQ(mol.atom(0).atomic_number, 8);
    EXPECT_EQ(mol.atom(1).symbol, "H");
    EXPECT_EQ(mol.atom(2).symbol, "H");

    // Should perceive 2 O-H bonds
    EXPECT_EQ(mol.num_bonds(), 2);
}

TEST(XYZParser, ParseMethane) {
    std::string xyz = read_file("data/test_molecules/methane.xyz");
    auto mol = parse_xyz(xyz);

    EXPECT_EQ(mol.num_atoms(), 5);
    EXPECT_EQ(mol.atom(0).symbol, "C");

    // 4 C-H bonds
    EXPECT_EQ(mol.num_bonds(), 4);
    EXPECT_EQ(mol.degree(0), 4);
}

TEST(XYZParser, ParseBenzene) {
    std::string xyz = read_file("data/test_molecules/benzene.xyz");
    auto mol = parse_xyz(xyz);

    EXPECT_EQ(mol.num_atoms(), 12);
    // 6 C-C + 6 C-H = 12 bonds
    EXPECT_EQ(mol.num_bonds(), 12);
}

TEST(XYZParser, WriteXYZ) {
    std::string xyz = "3\ntest\nO 0 0 0\nH 1 0 0\nH 0 1 0\n";
    auto mol = parse_xyz(xyz);
    std::string output = write_xyz(mol);

    // Parse the output and verify
    auto mol2 = parse_xyz(output);
    EXPECT_EQ(mol2.num_atoms(), 3);
    EXPECT_EQ(mol2.atom(0).symbol, "O");
}

TEST(XYZParser, InvalidInput) {
    EXPECT_THROW(parse_xyz(""), std::runtime_error);
    EXPECT_THROW(parse_xyz("abc\n"), std::runtime_error);
    EXPECT_THROW(parse_xyz("3\ncomment\nO 0 0\n"), std::runtime_error);
}
