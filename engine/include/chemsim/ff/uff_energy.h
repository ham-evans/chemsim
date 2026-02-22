#pragma once
#include <vector>
#include <string>
#include <Eigen/Dense>
#include "chemsim/core/molecule.h"

namespace chemsim {

struct EnergyComponents {
    double bond_stretch = 0.0;
    double angle_bend = 0.0;
    double torsion = 0.0;
    double vdw = 0.0;
    double total = 0.0;
};

// Internal data structures built during setup
struct AngleInfo {
    int i, j, k;  // atom indices (j is central)
};

struct TorsionInfo {
    int i, j, k, l;  // atom indices
};

class UFFForceField {
public:
    // Set up force field for a molecule
    void setup(const Molecule& mol);

    // Calculate total energy (kcal/mol)
    double calculate_energy(const Molecule& mol) const;

    // Calculate gradient (kcal/mol/Angstrom)
    Eigen::VectorXd calculate_gradient(const Molecule& mol) const;

    // Calculate energy with component breakdown
    EnergyComponents calculate_energy_components(const Molecule& mol) const;

    // Get assigned atom types
    const std::vector<std::string>& atom_types() const { return atom_types_; }

private:
    std::vector<std::string> atom_types_;
    std::vector<AngleInfo> angles_;
    std::vector<TorsionInfo> torsions_;
    std::vector<std::pair<int,int>> nonbonded_pairs_; // 1-4 and beyond

    // Individual energy term calculations
    double bond_stretch_energy(const Molecule& mol) const;
    void bond_stretch_gradient(const Molecule& mol, Eigen::VectorXd& grad) const;

    double angle_bend_energy(const Molecule& mol) const;
    void angle_bend_gradient(const Molecule& mol, Eigen::VectorXd& grad) const;

    double torsion_energy(const Molecule& mol) const;
    void torsion_gradient(const Molecule& mol, Eigen::VectorXd& grad) const;

    double vdw_energy(const Molecule& mol) const;
    void vdw_gradient(const Molecule& mol, Eigen::VectorXd& grad) const;

    // UFF bond length and force constant
    double uff_bond_length(int bond_idx, const Molecule& mol) const;
    double uff_bond_force_constant(int bond_idx, const Molecule& mol) const;
};

} // namespace chemsim
