#include "chemsim/io/sdf_parser.h"
#include "chemsim/core/element_data.h"
#include <sstream>
#include <stdexcept>

namespace chemsim {

Molecule parse_sdf(const std::string& content) {
    std::istringstream stream(content);
    Molecule mol;
    std::string line;

    // Line 1: molecule name
    if (!std::getline(stream, line)) throw std::runtime_error("SDF: empty input");
    mol.name = line;

    // Lines 2-3: header (program, comment)
    std::getline(stream, line);
    if (std::getline(stream, line)) mol.comment = line;

    // Counts line: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv
    if (!std::getline(stream, line)) throw std::runtime_error("SDF: missing counts line");
    if (line.size() < 6) throw std::runtime_error("SDF: counts line too short");

    int num_atoms, num_bonds;
    try {
        num_atoms = std::stoi(line.substr(0, 3));
        num_bonds = std::stoi(line.substr(3, 3));
    } catch (...) {
        throw std::runtime_error("SDF: invalid counts line: " + line);
    }

    // Atom block
    for (int i = 0; i < num_atoms; ++i) {
        if (!std::getline(stream, line)) {
            throw std::runtime_error("SDF: expected " + std::to_string(num_atoms) +
                                   " atoms, got " + std::to_string(i));
        }
        if (line.size() < 34) {
            throw std::runtime_error("SDF: atom line too short: " + line);
        }
        double x = std::stod(line.substr(0, 10));
        double y = std::stod(line.substr(10, 10));
        double z = std::stod(line.substr(20, 10));
        std::string symbol = line.substr(31, 3);
        // Trim whitespace from symbol
        size_t start = symbol.find_first_not_of(' ');
        size_t end = symbol.find_last_not_of(' ');
        if (start != std::string::npos) {
            symbol = symbol.substr(start, end - start + 1);
        }

        const auto& elem = element_by_symbol(symbol);
        mol.add_atom(Atom(elem.atomic_number, symbol, Eigen::Vector3d(x, y, z)));
    }

    // Bond block
    for (int i = 0; i < num_bonds; ++i) {
        if (!std::getline(stream, line)) {
            throw std::runtime_error("SDF: expected " + std::to_string(num_bonds) +
                                   " bonds, got " + std::to_string(i));
        }
        if (line.size() < 9) {
            throw std::runtime_error("SDF: bond line too short: " + line);
        }
        int a1 = std::stoi(line.substr(0, 3)) - 1; // 1-indexed to 0-indexed
        int a2 = std::stoi(line.substr(3, 3)) - 1;
        int order = std::stoi(line.substr(6, 3));
        // SDF bond order 4 = aromatic
        mol.add_bond(Bond(a1, a2, order));
    }

    return mol;
}

} // namespace chemsim
