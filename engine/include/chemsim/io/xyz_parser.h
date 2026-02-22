#pragma once
#include <string>
#include "chemsim/core/molecule.h"

namespace chemsim {

// Parse XYZ format string into a Molecule
// Format: line 1 = atom count, line 2 = comment, lines 3+ = symbol x y z
Molecule parse_xyz(const std::string& content);

// Write molecule to XYZ format string
std::string write_xyz(const Molecule& mol);

} // namespace chemsim
