#pragma once
#include <string>
#include <vector>
#include <unordered_map>

namespace chemsim {

struct UFFAtomType {
    std::string label;     // e.g. "C_3", "C_R", "H_"
    double r1;             // Bond radius (Angstroms)
    double theta0;         // Natural angle (degrees)
    double x1;             // Nonbond distance (Angstroms)
    double D1;             // Nonbond energy (kcal/mol)
    double zeta;           // Nonbond scale
    double Z1;             // Effective charge
    double Vi;             // sp3 torsion barrier (kcal/mol)
    double Uj;             // sp2 torsion barrier (kcal/mol)
    double Xi;             // Electronegativity (GMP)
    double hard;           // Hardness
    double radius;         // Atomic radius for vdw
};

// Get UFF parameters for a given atom type label
const UFFAtomType& get_uff_params(const std::string& label);

// Check if atom type exists
bool has_uff_type(const std::string& label);

// Get all registered UFF type labels
std::vector<std::string> get_all_uff_types();

} // namespace chemsim
