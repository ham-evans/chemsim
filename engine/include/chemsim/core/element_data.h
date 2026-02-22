#pragma once
#include <string>
#include <array>

namespace chemsim {

struct ElementInfo {
    int atomic_number;
    std::string symbol;
    std::string name;
    double mass;           // amu
    double covalent_radius; // Angstroms
    double vdw_radius;     // Angstroms
    std::array<float, 3> cpk_color; // RGB [0,1]
};

// Lookup by atomic number (1-118)
const ElementInfo& element_by_number(int atomic_number);

// Lookup by symbol ("H", "He", "Li", ...)
const ElementInfo& element_by_symbol(const std::string& symbol);

// Max supported atomic number
constexpr int MAX_ATOMIC_NUMBER = 118;

} // namespace chemsim
