#pragma once
#include <string>
#include "chemsim/core/molecule.h"

namespace chemsim {

// Parse SDF/MOL format string into a Molecule
Molecule parse_sdf(const std::string& content);

} // namespace chemsim
