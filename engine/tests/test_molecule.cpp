#include <gtest/gtest.h>
#include "chemsim/core/molecule.h"

using namespace chemsim;

TEST(Molecule, AddAtoms) {
    Molecule mol;
    mol.add_atom(Atom(8, "O", Eigen::Vector3d(0.0, 0.0, 0.1173)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.0, 0.7572, -0.4692)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.0, -0.7572, -0.4692)));

    EXPECT_EQ(mol.num_atoms(), 3);
    EXPECT_EQ(mol.atom(0).symbol, "O");
    EXPECT_EQ(mol.atom(1).symbol, "H");
}

TEST(Molecule, PerceiveBonds) {
    Molecule mol;
    mol.add_atom(Atom(8, "O", Eigen::Vector3d(0.0, 0.0, 0.1173)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.0, 0.7572, -0.4692)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.0, -0.7572, -0.4692)));
    mol.perceive_bonds();

    EXPECT_EQ(mol.num_bonds(), 2);  // Two O-H bonds
    EXPECT_EQ(mol.degree(0), 2);    // O has 2 bonds
    EXPECT_EQ(mol.degree(1), 1);    // H has 1 bond
}

TEST(Molecule, GetSetPositions) {
    Molecule mol;
    mol.add_atom(Atom(6, "C", Eigen::Vector3d(0, 0, 0)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(1, 0, 0)));

    auto pos = mol.get_positions();
    EXPECT_EQ(pos.size(), 6u);
    EXPECT_DOUBLE_EQ(pos[3], 1.0);

    pos[3] = 2.0;
    mol.set_positions(pos);
    EXPECT_DOUBLE_EQ(mol.atom(1).position.x(), 2.0);
}

TEST(Molecule, Adjacency) {
    Molecule mol;
    mol.add_atom(Atom(8, "O", Eigen::Vector3d(0, 0, 0)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.96, 0, 0)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(-0.24, 0.93, 0)));
    mol.perceive_bonds();

    auto bonded = mol.bonded_to(0);
    EXPECT_EQ(bonded.size(), 2u);
}

TEST(Molecule, Methane) {
    Molecule mol;
    mol.add_atom(Atom(6, "C", Eigen::Vector3d(0, 0, 0)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.629, 0.629, 0.629)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(-0.629, -0.629, 0.629)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(-0.629, 0.629, -0.629)));
    mol.add_atom(Atom(1, "H", Eigen::Vector3d(0.629, -0.629, -0.629)));
    mol.perceive_bonds();

    EXPECT_EQ(mol.num_atoms(), 5);
    EXPECT_EQ(mol.num_bonds(), 4);  // Four C-H bonds
    EXPECT_EQ(mol.degree(0), 4);     // C has 4 bonds
}
