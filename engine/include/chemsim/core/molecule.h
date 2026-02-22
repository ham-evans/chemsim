#pragma once
#include <vector>
#include <string>
#include <Eigen/Dense>

namespace chemsim {

struct Atom {
    int atomic_number;
    std::string symbol;
    Eigen::Vector3d position; // Angstroms

    Atom() : atomic_number(0), position(Eigen::Vector3d::Zero()) {}
    Atom(int z, const std::string& sym, const Eigen::Vector3d& pos)
        : atomic_number(z), symbol(sym), position(pos) {}
};

struct Bond {
    int atom_i;
    int atom_j;
    int order; // 1=single, 2=double, 3=triple, 4=aromatic

    Bond() : atom_i(0), atom_j(0), order(1) {}
    Bond(int i, int j, int ord = 1) : atom_i(i), atom_j(j), order(ord) {}
};

class Molecule {
public:
    Molecule() = default;

    void add_atom(const Atom& atom);
    void add_bond(const Bond& bond);

    // Perceive bonds from distance-based covalent radii
    void perceive_bonds(double tolerance = 0.45);

    // Accessors
    int num_atoms() const { return static_cast<int>(atoms_.size()); }
    int num_bonds() const { return static_cast<int>(bonds_.size()); }

    const Atom& atom(int i) const { return atoms_[i]; }
    Atom& atom(int i) { return atoms_[i]; }
    const Bond& bond(int i) const { return bonds_[i]; }

    const std::vector<Atom>& atoms() const { return atoms_; }
    const std::vector<Bond>& bonds() const { return bonds_; }

    // Get/set all positions as flat vector (3*N)
    std::vector<double> get_positions() const;
    void set_positions(const std::vector<double>& positions);

    // Get adjacency: list of bonded atom indices for each atom
    std::vector<std::vector<int>> adjacency_list() const;

    // Connectivity
    int degree(int atom_idx) const;
    std::vector<int> bonded_to(int atom_idx) const;
    int bond_order_between(int i, int j) const;

    std::string name;
    std::string comment;

private:
    std::vector<Atom> atoms_;
    std::vector<Bond> bonds_;
};

} // namespace chemsim
