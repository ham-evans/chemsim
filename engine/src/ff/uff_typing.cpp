#include "chemsim/ff/uff_typing.h"
#include "chemsim/ff/uff_params.h"
#include <stdexcept>

namespace chemsim {

std::vector<std::string> assign_uff_types(const Molecule& mol) {
    std::vector<std::string> types(mol.num_atoms());

    for (int i = 0; i < mol.num_atoms(); ++i) {
        const auto& atom = mol.atom(i);
        int deg = mol.degree(i);
        std::string type;

        switch (atom.atomic_number) {
            case 1:  // H
                type = "H_";
                break;
            case 2:  // He
                type = "He4+4";
                break;
            case 3:  // Li
                type = "Li";
                break;
            case 4:  // Be
                type = "Be3+2";
                break;
            case 5:  // B
                if (deg <= 2) type = "B_2";
                else type = "B_3";
                break;
            case 6:  // C
                if (deg <= 1) type = "C_1";
                else if (deg == 2) type = "C_2";
                else if (deg == 3) {
                    // Check for aromatic: simple heuristic - if bonded to
                    // atoms that also have degree 3 (aromatic ring-like)
                    bool aromatic = false;
                    auto neighbors = mol.bonded_to(i);
                    for (int n : neighbors) {
                        if (mol.atom(n).atomic_number == 6 && mol.degree(n) == 3) {
                            aromatic = true;
                            break;
                        }
                    }
                    type = aromatic ? "C_R" : "C_2";
                }
                else type = "C_3"; // deg >= 4
                break;
            case 7:  // N
                if (deg <= 1) type = "N_1";
                else if (deg == 2) type = "N_2";
                else if (deg == 3) {
                    // Check if in aromatic ring
                    bool aromatic = false;
                    auto neighbors = mol.bonded_to(i);
                    for (int n : neighbors) {
                        if (mol.atom(n).atomic_number == 6 && mol.degree(n) == 3) {
                            aromatic = true;
                            break;
                        }
                    }
                    type = aromatic ? "N_R" : "N_3";
                }
                else type = "N_3";
                break;
            case 8:  // O
                if (deg <= 1) type = "O_2";
                else if (deg == 2) {
                    // Check if in aromatic ring
                    bool aromatic = false;
                    auto neighbors = mol.bonded_to(i);
                    for (int n : neighbors) {
                        if (mol.atom(n).atomic_number == 6 && mol.degree(n) == 3) {
                            aromatic = true;
                            break;
                        }
                    }
                    type = aromatic ? "O_R" : "O_3";
                }
                else type = "O_3";
                break;
            case 9:  // F
                type = "F_";
                break;
            case 10: // Ne
                type = "Ne4+4";
                break;
            case 11: // Na
                type = "Na";
                break;
            case 12: // Mg
                type = "Mg3+2";
                break;
            case 13: // Al
                type = "Al3";
                break;
            case 14: // Si
                type = "Si3";
                break;
            case 15: // P
                if (deg <= 3) type = "P_3+3";
                else type = "P_3+5";
                break;
            case 16: // S
                if (deg <= 2) type = "S_3+2";
                else if (deg <= 4) type = "S_3+4";
                else type = "S_3+6";
                break;
            case 17: // Cl
                type = "Cl";
                break;
            case 18: // Ar
                type = "Ar4+4";
                break;
            case 19: // K
                type = "K_";
                break;
            case 20: // Ca
                type = "Ca6+2";
                break;
            case 26: // Fe
                type = "Fe3+2";
                break;
            case 27: // Co
                type = "Co6+3";
                break;
            case 28: // Ni
                type = "Ni4+2";
                break;
            case 29: // Cu
                type = "Cu3+1";
                break;
            case 30: // Zn
                type = "Zn3+2";
                break;
            case 35: // Br
                type = "Br";
                break;
            case 53: // I
                type = "I_";
                break;
            default:
                // Fallback: try element symbol with common suffixes
                if (has_uff_type(atom.symbol + "_3")) {
                    type = atom.symbol + "_3";
                } else if (has_uff_type(atom.symbol + "_")) {
                    type = atom.symbol + "_";
                } else if (has_uff_type(atom.symbol)) {
                    type = atom.symbol;
                } else {
                    throw std::runtime_error("No UFF type for element: " + atom.symbol +
                                           " (Z=" + std::to_string(atom.atomic_number) + ")");
                }
                break;
        }

        types[i] = type;
    }

    return types;
}

} // namespace chemsim
