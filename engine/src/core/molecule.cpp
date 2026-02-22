#include "chemsim/core/molecule.h"
#include "chemsim/core/element_data.h"
#include <cmath>
#include <set>

namespace chemsim {

void Molecule::add_atom(const Atom& atom) {
    atoms_.push_back(atom);
}

void Molecule::add_bond(const Bond& bond) {
    bonds_.push_back(bond);
}

void Molecule::perceive_bonds(double tolerance) {
    bonds_.clear();
    int n = num_atoms();
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            double dist = (atoms_[i].position - atoms_[j].position).norm();
            double ri = element_by_number(atoms_[i].atomic_number).covalent_radius;
            double rj = element_by_number(atoms_[j].atomic_number).covalent_radius;
            double max_bond = ri + rj + tolerance;
            double min_bond = 0.4; // Minimum bond distance
            if (dist >= min_bond && dist <= max_bond) {
                bonds_.emplace_back(i, j, 1);
            }
        }
    }
}

std::vector<double> Molecule::get_positions() const {
    std::vector<double> pos(3 * atoms_.size());
    for (size_t i = 0; i < atoms_.size(); ++i) {
        pos[3*i + 0] = atoms_[i].position.x();
        pos[3*i + 1] = atoms_[i].position.y();
        pos[3*i + 2] = atoms_[i].position.z();
    }
    return pos;
}

void Molecule::set_positions(const std::vector<double>& positions) {
    if (positions.size() != 3 * atoms_.size()) {
        throw std::runtime_error("Position vector size mismatch");
    }
    for (size_t i = 0; i < atoms_.size(); ++i) {
        atoms_[i].position.x() = positions[3*i + 0];
        atoms_[i].position.y() = positions[3*i + 1];
        atoms_[i].position.z() = positions[3*i + 2];
    }
}

std::vector<std::vector<int>> Molecule::adjacency_list() const {
    std::vector<std::vector<int>> adj(atoms_.size());
    for (const auto& bond : bonds_) {
        adj[bond.atom_i].push_back(bond.atom_j);
        adj[bond.atom_j].push_back(bond.atom_i);
    }
    return adj;
}

int Molecule::degree(int atom_idx) const {
    int count = 0;
    for (const auto& bond : bonds_) {
        if (bond.atom_i == atom_idx || bond.atom_j == atom_idx) {
            count++;
        }
    }
    return count;
}

std::vector<int> Molecule::bonded_to(int atom_idx) const {
    std::vector<int> neighbors;
    for (const auto& bond : bonds_) {
        if (bond.atom_i == atom_idx) neighbors.push_back(bond.atom_j);
        else if (bond.atom_j == atom_idx) neighbors.push_back(bond.atom_i);
    }
    return neighbors;
}

int Molecule::bond_order_between(int i, int j) const {
    for (const auto& bond : bonds_) {
        if ((bond.atom_i == i && bond.atom_j == j) ||
            (bond.atom_i == j && bond.atom_j == i)) {
            return bond.order;
        }
    }
    return 0;
}

} // namespace chemsim
