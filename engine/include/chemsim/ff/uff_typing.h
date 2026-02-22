#pragma once
#include <string>
#include <vector>
#include "chemsim/core/molecule.h"

namespace chemsim {

// Assign UFF atom types to all atoms in a molecule
// Returns vector of UFF type labels (e.g., "C_3", "H_", "O_3")
std::vector<std::string> assign_uff_types(const Molecule& mol);

} // namespace chemsim
