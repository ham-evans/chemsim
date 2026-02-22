#include "chemsim/io/xyz_parser.h"
#include "chemsim/core/element_data.h"
#include <sstream>
#include <stdexcept>

namespace chemsim {

Molecule parse_xyz(const std::string& content) {
    std::istringstream stream(content);
    Molecule mol;

    // Line 1: atom count
    std::string line;
    if (!std::getline(stream, line)) {
        throw std::runtime_error("XYZ: empty input");
    }
    int num_atoms;
    try {
        num_atoms = std::stoi(line);
    } catch (...) {
        throw std::runtime_error("XYZ: invalid atom count: " + line);
    }
    if (num_atoms < 0) {
        throw std::runtime_error("XYZ: negative atom count");
    }

    // Line 2: comment
    if (!std::getline(stream, line)) {
        throw std::runtime_error("XYZ: missing comment line");
    }
    mol.comment = line;

    // Lines 3+: symbol x y z
    for (int i = 0; i < num_atoms; ++i) {
        if (!std::getline(stream, line)) {
            throw std::runtime_error("XYZ: expected " + std::to_string(num_atoms) +
                                   " atoms, got " + std::to_string(i));
        }
        std::istringstream atom_stream(line);
        std::string symbol;
        double x, y, z;
        if (!(atom_stream >> symbol >> x >> y >> z)) {
            throw std::runtime_error("XYZ: malformed atom line: " + line);
        }

        const auto& elem = element_by_symbol(symbol);
        mol.add_atom(Atom(elem.atomic_number, symbol, Eigen::Vector3d(x, y, z)));
    }

    // Perceive bonds from distances
    mol.perceive_bonds();
    return mol;
}

std::string write_xyz(const Molecule& mol) {
    std::ostringstream out;
    out << mol.num_atoms() << "\n";
    out << mol.comment << "\n";
    for (int i = 0; i < mol.num_atoms(); ++i) {
        const auto& a = mol.atom(i);
        out << a.symbol << " "
            << a.position.x() << " "
            << a.position.y() << " "
            << a.position.z() << "\n";
    }
    return out.str();
}

} // namespace chemsim
