#include "chemsim/core/element_data.h"
#include <algorithm>
#include <stdexcept>
#include <unordered_map>

namespace chemsim {

// Periodic table data: atomic_number, symbol, name, mass, covalent_radius, vdw_radius, cpk_color
static const ElementInfo ELEMENT_TABLE[] = {
    {0,  "X",  "Dummy",      0.000, 0.00, 0.00, {1.0f, 0.0f, 1.0f}},  // placeholder
    {1,  "H",  "Hydrogen",   1.008, 0.31, 1.20, {1.0f, 1.0f, 1.0f}},
    {2,  "He", "Helium",     4.003, 0.28, 1.40, {0.85f, 1.0f, 1.0f}},
    {3,  "Li", "Lithium",    6.941, 1.28, 1.82, {0.8f, 0.5f, 1.0f}},
    {4,  "Be", "Beryllium",  9.012, 0.96, 1.53, {0.76f, 1.0f, 0.0f}},
    {5,  "B",  "Boron",     10.811, 0.84, 1.92, {1.0f, 0.71f, 0.71f}},
    {6,  "C",  "Carbon",    12.011, 0.76, 1.70, {0.56f, 0.56f, 0.56f}},
    {7,  "N",  "Nitrogen",  14.007, 0.71, 1.55, {0.19f, 0.31f, 0.97f}},
    {8,  "O",  "Oxygen",    15.999, 0.66, 1.52, {1.0f, 0.05f, 0.05f}},
    {9,  "F",  "Fluorine",  18.998, 0.57, 1.47, {0.56f, 0.88f, 0.31f}},
    {10, "Ne", "Neon",      20.180, 0.58, 1.54, {0.7f, 0.89f, 0.96f}},
    {11, "Na", "Sodium",    22.990, 1.66, 2.27, {0.67f, 0.36f, 0.95f}},
    {12, "Mg", "Magnesium", 24.305, 1.41, 1.73, {0.54f, 1.0f, 0.0f}},
    {13, "Al", "Aluminum",  26.982, 1.21, 1.84, {0.75f, 0.65f, 0.65f}},
    {14, "Si", "Silicon",   28.086, 1.11, 2.10, {0.94f, 0.78f, 0.63f}},
    {15, "P",  "Phosphorus",30.974, 1.07, 1.80, {1.0f, 0.5f, 0.0f}},
    {16, "S",  "Sulfur",    32.065, 1.05, 1.80, {1.0f, 1.0f, 0.19f}},
    {17, "Cl", "Chlorine",  35.453, 1.02, 1.75, {0.12f, 0.94f, 0.12f}},
    {18, "Ar", "Argon",     39.948, 1.06, 1.88, {0.5f, 0.82f, 0.89f}},
    {19, "K",  "Potassium", 39.098, 2.03, 2.75, {0.56f, 0.25f, 0.83f}},
    {20, "Ca", "Calcium",   40.078, 1.76, 2.31, {0.24f, 1.0f, 0.0f}},
    {21, "Sc", "Scandium",  44.956, 1.70, 2.11, {0.9f, 0.9f, 0.9f}},
    {22, "Ti", "Titanium",  47.867, 1.60, 1.87, {0.75f, 0.76f, 0.78f}},
    {23, "V",  "Vanadium",  50.942, 1.53, 1.79, {0.65f, 0.65f, 0.67f}},
    {24, "Cr", "Chromium",  51.996, 1.39, 1.89, {0.54f, 0.6f, 0.78f}},
    {25, "Mn", "Manganese", 54.938, 1.39, 1.97, {0.61f, 0.48f, 0.78f}},
    {26, "Fe", "Iron",      55.845, 1.32, 1.94, {0.88f, 0.4f, 0.2f}},
    {27, "Co", "Cobalt",    58.933, 1.26, 1.92, {0.94f, 0.56f, 0.63f}},
    {28, "Ni", "Nickel",    58.693, 1.24, 1.63, {0.31f, 0.82f, 0.31f}},
    {29, "Cu", "Copper",    63.546, 1.32, 1.40, {0.78f, 0.5f, 0.2f}},
    {30, "Zn", "Zinc",      65.380, 1.22, 1.39, {0.49f, 0.5f, 0.69f}},
    {31, "Ga", "Gallium",   69.723, 1.22, 1.87, {0.76f, 0.56f, 0.56f}},
    {32, "Ge", "Germanium", 72.640, 1.20, 2.11, {0.4f, 0.56f, 0.56f}},
    {33, "As", "Arsenic",   74.922, 1.19, 1.85, {0.74f, 0.5f, 0.89f}},
    {34, "Se", "Selenium",  78.960, 1.20, 1.90, {1.0f, 0.63f, 0.0f}},
    {35, "Br", "Bromine",   79.904, 1.20, 1.85, {0.65f, 0.16f, 0.16f}},
    {36, "Kr", "Krypton",   83.798, 1.16, 2.02, {0.36f, 0.72f, 0.82f}},
    {37, "Rb", "Rubidium",  85.468, 2.20, 3.03, {0.44f, 0.18f, 0.69f}},
    {38, "Sr", "Strontium", 87.620, 1.95, 2.49, {0.0f, 1.0f, 0.0f}},
    {39, "Y",  "Yttrium",   88.906, 1.90, 2.19, {0.58f, 1.0f, 1.0f}},
    {40, "Zr", "Zirconium", 91.224, 1.75, 1.86, {0.58f, 0.88f, 0.88f}},
    {41, "Nb", "Niobium",   92.906, 1.64, 2.07, {0.45f, 0.76f, 0.79f}},
    {42, "Mo", "Molybdenum",95.960, 1.54, 2.09, {0.33f, 0.71f, 0.71f}},
    {43, "Tc", "Technetium",98.000, 1.47, 2.09, {0.23f, 0.62f, 0.62f}},
    {44, "Ru", "Ruthenium",101.070, 1.46, 2.07, {0.14f, 0.56f, 0.56f}},
    {45, "Rh", "Rhodium",  102.906, 1.42, 1.95, {0.04f, 0.49f, 0.55f}},
    {46, "Pd", "Palladium",106.420, 1.39, 2.02, {0.0f, 0.41f, 0.52f}},
    {47, "Ag", "Silver",   107.868, 1.45, 1.72, {0.75f, 0.75f, 0.75f}},
    {48, "Cd", "Cadmium",  112.411, 1.44, 1.58, {1.0f, 0.85f, 0.56f}},
    {49, "In", "Indium",   114.818, 1.42, 1.93, {0.65f, 0.46f, 0.45f}},
    {50, "Sn", "Tin",      118.710, 1.39, 2.17, {0.4f, 0.5f, 0.5f}},
    {51, "Sb", "Antimony", 121.760, 1.39, 2.06, {0.62f, 0.39f, 0.71f}},
    {52, "Te", "Tellurium",127.600, 1.38, 2.06, {0.83f, 0.48f, 0.0f}},
    {53, "I",  "Iodine",   126.905, 1.39, 1.98, {0.58f, 0.0f, 0.58f}},
    {54, "Xe", "Xenon",    131.293, 1.40, 2.16, {0.26f, 0.62f, 0.69f}},
};

static const int NUM_ELEMENTS = sizeof(ELEMENT_TABLE) / sizeof(ELEMENT_TABLE[0]);

// Build symbol lookup map on first use
static const std::unordered_map<std::string, int>& symbol_map() {
    static std::unordered_map<std::string, int> map;
    if (map.empty()) {
        for (int i = 0; i < NUM_ELEMENTS; ++i) {
            map[ELEMENT_TABLE[i].symbol] = i;
        }
    }
    return map;
}

const ElementInfo& element_by_number(int atomic_number) {
    if (atomic_number < 0 || atomic_number >= NUM_ELEMENTS) {
        throw std::out_of_range("Atomic number " + std::to_string(atomic_number) + " out of range");
    }
    return ELEMENT_TABLE[atomic_number];
}

const ElementInfo& element_by_symbol(const std::string& symbol) {
    const auto& map = symbol_map();
    auto it = map.find(symbol);
    if (it == map.end()) {
        throw std::out_of_range("Unknown element symbol: " + symbol);
    }
    return ELEMENT_TABLE[it->second];
}

} // namespace chemsim
