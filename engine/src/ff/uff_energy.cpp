#include "chemsim/ff/uff_energy.h"
#include "chemsim/ff/uff_params.h"
#include "chemsim/ff/uff_typing.h"
#include <cmath>
#include <set>
#include <algorithm>

namespace chemsim {

static const double DEG2RAD = M_PI / 180.0;
static const double RAD2DEG = 180.0 / M_PI;

void UFFForceField::setup(const Molecule& mol) {
    atom_types_ = assign_uff_types(mol);

    // Build angle list: for each atom j with 2+ bonds, enumerate i-j-k triples
    angles_.clear();
    auto adj = mol.adjacency_list();
    for (int j = 0; j < mol.num_atoms(); ++j) {
        const auto& neighbors = adj[j];
        for (size_t a = 0; a < neighbors.size(); ++a) {
            for (size_t b = a + 1; b < neighbors.size(); ++b) {
                angles_.push_back({neighbors[a], j, neighbors[b]});
            }
        }
    }

    // Build torsion list: for each bond j-k, enumerate i-j-k-l
    torsions_.clear();
    for (const auto& bond : mol.bonds()) {
        int j = bond.atom_i;
        int k = bond.atom_j;
        const auto& nbrs_j = adj[j];
        const auto& nbrs_k = adj[k];
        for (int i : nbrs_j) {
            if (i == k) continue;
            for (int l : nbrs_k) {
                if (l == j || l == i) continue;
                torsions_.push_back({i, j, k, l});
            }
        }
    }

    // Build non-bonded pair list (1-4 and beyond)
    // Exclude 1-2 (bonded) and 1-3 (angle) pairs
    std::set<std::pair<int,int>> excluded;
    for (const auto& bond : mol.bonds()) {
        int a = std::min(bond.atom_i, bond.atom_j);
        int b = std::max(bond.atom_i, bond.atom_j);
        excluded.insert({a, b});
    }
    for (const auto& angle : angles_) {
        int a = std::min(angle.i, angle.k);
        int b = std::max(angle.i, angle.k);
        excluded.insert({a, b});
    }

    nonbonded_pairs_.clear();
    for (int i = 0; i < mol.num_atoms(); ++i) {
        for (int j = i + 1; j < mol.num_atoms(); ++j) {
            if (excluded.find({i, j}) == excluded.end()) {
                nonbonded_pairs_.push_back({i, j});
            }
        }
    }
}

// ============ UFF Bond Parameters ============

double UFFForceField::uff_bond_length(int bond_idx, const Molecule& mol) const {
    const auto& bond = mol.bond(bond_idx);
    const auto& pi = get_uff_params(atom_types_[bond.atom_i]);
    const auto& pj = get_uff_params(atom_types_[bond.atom_j]);

    // UFF natural bond length: r_ij = r_i + r_j + r_BO + r_EN
    double r_BO = -0.1332 * (pi.r1 + pj.r1) * std::log(bond.order);
    double chi_diff = std::sqrt(pi.Xi) - std::sqrt(pj.Xi);
    double r_EN = pi.r1 * pj.r1 * chi_diff * chi_diff /
                  (pi.Xi * pi.r1 + pj.Xi * pj.r1);

    return pi.r1 + pj.r1 + r_BO - r_EN;
}

double UFFForceField::uff_bond_force_constant(int bond_idx, const Molecule& mol) const {
    const auto& bond = mol.bond(bond_idx);
    const auto& pi = get_uff_params(atom_types_[bond.atom_i]);
    const auto& pj = get_uff_params(atom_types_[bond.atom_j]);

    double r0 = uff_bond_length(bond_idx, mol);
    // k = 664.12 * Z_i * Z_j / r0^3
    return 664.12 * pi.Z1 * pj.Z1 / (r0 * r0 * r0);
}

// ============ Bond Stretch ============

double UFFForceField::bond_stretch_energy(const Molecule& mol) const {
    double E = 0.0;
    for (int b = 0; b < mol.num_bonds(); ++b) {
        const auto& bond = mol.bond(b);
        double r = (mol.atom(bond.atom_i).position - mol.atom(bond.atom_j).position).norm();
        double r0 = uff_bond_length(b, mol);
        double k = uff_bond_force_constant(b, mol);
        double dr = r - r0;
        E += 0.5 * k * dr * dr;
    }
    return E;
}

void UFFForceField::bond_stretch_gradient(const Molecule& mol, Eigen::VectorXd& grad) const {
    for (int b = 0; b < mol.num_bonds(); ++b) {
        const auto& bond = mol.bond(b);
        int i = bond.atom_i, j = bond.atom_j;
        Eigen::Vector3d rij = mol.atom(i).position - mol.atom(j).position;
        double r = rij.norm();
        if (r < 1e-10) continue;

        double r0 = uff_bond_length(b, mol);
        double k = uff_bond_force_constant(b, mol);

        // dE/dr = k * (r - r0)
        // dr/dx_i = rij / r
        Eigen::Vector3d dE = k * (r - r0) * rij / r;
        grad.segment<3>(3*i) += dE;
        grad.segment<3>(3*j) -= dE;
    }
}

// ============ Angle Bend ============

double UFFForceField::angle_bend_energy(const Molecule& mol) const {
    double E = 0.0;
    for (const auto& angle : angles_) {
        int i = angle.i, j = angle.j, k = angle.k;
        Eigen::Vector3d rji = mol.atom(i).position - mol.atom(j).position;
        Eigen::Vector3d rjk = mol.atom(k).position - mol.atom(j).position;
        double dji = rji.norm();
        double djk = rjk.norm();
        if (dji < 1e-10 || djk < 1e-10) continue;

        double cos_theta = rji.dot(rjk) / (dji * djk);
        cos_theta = std::max(-1.0, std::min(1.0, cos_theta));
        double theta = std::acos(cos_theta);

        const auto& pj = get_uff_params(atom_types_[j]);
        double theta0 = pj.theta0 * DEG2RAD;

        // UFF force constant for angle bending
        const auto& pi = get_uff_params(atom_types_[i]);
        const auto& pk = get_uff_params(atom_types_[k]);
        double r_ij = pi.r1 + pj.r1; // approximate
        double r_jk = pj.r1 + pk.r1;

        double beta = 664.12 / (r_ij * r_jk);
        double Z_i = pi.Z1, Z_k = pk.Z1;
        double K = beta * Z_i * Z_k / (r_ij * r_jk * r_ij * r_jk * r_jk);
        // Simplified: K = 664.12 * Z_i * Z_k / (r_ij * r_jk)^3 * r_ij * r_jk
        K = 664.12 / (r_ij * r_jk) * Z_i * Z_k / (r_ij * r_jk * r_ij * r_jk * r_jk);

        // More standard UFF angle force constant:
        // K_ijk = beta * (Z_i * Z_k / r_ik^5) * r_ij * r_jk *
        //         [3*r_ij*r_jk*(1-cos^2(theta0)) - r_ik^2*cos(theta0)]
        // But for simplicity, use the harmonic approximation that works well:
        double r_ik_sq = r_ij*r_ij + r_jk*r_jk - 2.0*r_ij*r_jk*std::cos(theta0);
        double r_ik = std::sqrt(std::max(r_ik_sq, 0.01));
        double r_ik5 = r_ik * r_ik * r_ik * r_ik * r_ik;

        K = 664.12 * Z_i * Z_k / r_ik5;
        K *= r_ij * r_jk;
        double cos_theta0 = std::cos(theta0);
        K *= 3.0 * r_ij * r_jk * (1.0 - cos_theta0 * cos_theta0) - r_ik_sq * cos_theta0;

        if (std::abs(K) < 1e-10) continue;

        // Use Fourier expansion based on coordination
        double sin_theta0 = std::sin(theta0);

        if (std::abs(theta0 - M_PI) < 0.01) {
            // Linear: E = K * (1 + cos(theta))
            E += K * (1.0 + cos_theta);
        } else if (std::abs(theta0 - 2.0*M_PI/3.0) < 0.01) {
            // Trigonal planar (120 deg): E = K/4.5 * (1 - cos(3*theta)) -- actually no
            // General small-angle Fourier:
            double C2 = 1.0 / (4.0 * sin_theta0 * sin_theta0);
            double C1 = -4.0 * C2 * cos_theta0;
            double C0 = C2 * (2.0 * cos_theta0 * cos_theta0 + 1.0);
            E += K * (C0 + C1 * cos_theta + C2 * std::cos(2.0 * theta));
        } else {
            // General: Fourier expansion
            double C2 = 1.0 / (4.0 * sin_theta0 * sin_theta0);
            double C1 = -4.0 * C2 * cos_theta0;
            double C0 = C2 * (2.0 * cos_theta0 * cos_theta0 + 1.0);
            E += K * (C0 + C1 * cos_theta + C2 * std::cos(2.0 * theta));
        }
    }
    return E;
}

void UFFForceField::angle_bend_gradient(const Molecule& mol, Eigen::VectorXd& grad) const {
    for (const auto& angle : angles_) {
        int i = angle.i, j = angle.j, k = angle.k;
        Eigen::Vector3d rji = mol.atom(i).position - mol.atom(j).position;
        Eigen::Vector3d rjk = mol.atom(k).position - mol.atom(j).position;
        double dji = rji.norm();
        double djk = rjk.norm();
        if (dji < 1e-10 || djk < 1e-10) continue;

        double cos_theta = rji.dot(rjk) / (dji * djk);
        cos_theta = std::max(-1.0, std::min(1.0, cos_theta));
        double theta = std::acos(cos_theta);
        double sin_theta = std::sin(theta);
        if (std::abs(sin_theta) < 1e-10) sin_theta = 1e-10;

        const auto& pj = get_uff_params(atom_types_[j]);
        const auto& pi = get_uff_params(atom_types_[i]);
        const auto& pk = get_uff_params(atom_types_[k]);
        double theta0 = pj.theta0 * DEG2RAD;
        double cos_theta0 = std::cos(theta0);
        double sin_theta0 = std::sin(theta0);

        double r_ij = pi.r1 + pj.r1;
        double r_jk = pj.r1 + pk.r1;
        double r_ik_sq = r_ij*r_ij + r_jk*r_jk - 2.0*r_ij*r_jk*cos_theta0;
        double r_ik = std::sqrt(std::max(r_ik_sq, 0.01));
        double r_ik5 = r_ik*r_ik*r_ik*r_ik*r_ik;

        double K = 664.12 * pi.Z1 * pk.Z1 / r_ik5;
        K *= r_ij * r_jk;
        K *= 3.0 * r_ij * r_jk * (1.0 - cos_theta0*cos_theta0) - r_ik_sq * cos_theta0;

        if (std::abs(K) < 1e-10) continue;

        // dE/dtheta
        double dE_dtheta;
        if (std::abs(theta0 - M_PI) < 0.01) {
            dE_dtheta = -K * sin_theta;
        } else {
            double C2 = 1.0 / (4.0 * sin_theta0 * sin_theta0);
            double C1 = -4.0 * C2 * cos_theta0;
            dE_dtheta = K * (-C1 * sin_theta - 2.0 * C2 * std::sin(2.0 * theta));
        }

        // dtheta/d(positions) - standard angle gradient
        Eigen::Vector3d uji = rji / dji;
        Eigen::Vector3d ujk = rjk / djk;

        // d(cos_theta)/d(r_i) = (ujk - cos_theta * uji) / dji
        // d(theta)/d(r_i) = -1/sin_theta * d(cos_theta)/d(r_i)
        Eigen::Vector3d dthetadri = -(ujk - cos_theta * uji) / (dji * sin_theta);
        Eigen::Vector3d dthetadrk = -(uji - cos_theta * ujk) / (djk * sin_theta);
        Eigen::Vector3d dthetadrj = -dthetadri - dthetadrk;

        grad.segment<3>(3*i) += dE_dtheta * dthetadri;
        grad.segment<3>(3*j) += dE_dtheta * dthetadrj;
        grad.segment<3>(3*k) += dE_dtheta * dthetadrk;
    }
}

// ============ Torsion ============

static double compute_dihedral(const Eigen::Vector3d& p1, const Eigen::Vector3d& p2,
                               const Eigen::Vector3d& p3, const Eigen::Vector3d& p4) {
    Eigen::Vector3d b1 = p2 - p1;
    Eigen::Vector3d b2 = p3 - p2;
    Eigen::Vector3d b3 = p4 - p3;

    Eigen::Vector3d n1 = b1.cross(b2);
    Eigen::Vector3d n2 = b2.cross(b3);

    double n1_norm = n1.norm();
    double n2_norm = n2.norm();
    if (n1_norm < 1e-10 || n2_norm < 1e-10) return 0.0;

    n1 /= n1_norm;
    n2 /= n2_norm;

    double cos_phi = n1.dot(n2);
    cos_phi = std::max(-1.0, std::min(1.0, cos_phi));
    double phi = std::acos(cos_phi);

    // Sign
    if (n1.dot(b3) < 0.0) phi = -phi;
    return phi;
}

double UFFForceField::torsion_energy(const Molecule& mol) const {
    double E = 0.0;
    for (const auto& tor : torsions_) {
        double phi = compute_dihedral(mol.atom(tor.i).position, mol.atom(tor.j).position,
                                      mol.atom(tor.k).position, mol.atom(tor.l).position);

        const auto& pj = get_uff_params(atom_types_[tor.j]);
        const auto& pk = get_uff_params(atom_types_[tor.k]);

        // Determine periodicity and barrier from hybridization
        // sp3-sp3: n=3, V = sqrt(Vi*Vj)
        // sp2-sp2: n=2, V = 5*sqrt(Uj*Uk)*(1+4.18*ln(bond_order))
        // sp3-sp2: n=6, V = sqrt(Vi*Uj) (or 1 kcal/mol default)
        double V = 0.0;
        int n = 3;
        double phi0 = M_PI; // or 0.0

        // Simple heuristic based on theta0
        bool j_sp3 = std::abs(pj.theta0 - 109.47) < 5.0;
        bool k_sp3 = std::abs(pk.theta0 - 109.47) < 5.0;
        bool j_sp2 = std::abs(pj.theta0 - 120.0) < 5.0 || std::abs(pj.theta0 - 111.2) < 5.0;
        bool k_sp2 = std::abs(pk.theta0 - 120.0) < 5.0 || std::abs(pk.theta0 - 111.2) < 5.0;

        if (j_sp3 && k_sp3) {
            n = 3;
            phi0 = M_PI;
            V = std::sqrt(std::abs(pj.Vi * pk.Vi));
        } else if (j_sp2 && k_sp2) {
            n = 2;
            phi0 = M_PI;
            V = 5.0 * std::sqrt(std::abs(pj.Uj * pk.Uj));
        } else if ((j_sp3 && k_sp2) || (j_sp2 && k_sp3)) {
            n = 6;
            phi0 = 0.0;
            V = 1.0; // default barrier
        } else {
            // Default: small barrier
            n = 3;
            phi0 = M_PI;
            V = 0.5;
        }

        if (V < 1e-10) continue;

        // E = 0.5 * V * (1 - cos(n*phi0)*cos(n*phi))
        E += 0.5 * V * (1.0 - std::cos(n * phi0) * std::cos(n * phi));
    }
    return E;
}

void UFFForceField::torsion_gradient(const Molecule& mol, Eigen::VectorXd& grad) const {
    for (const auto& tor : torsions_) {
        const auto& p1 = mol.atom(tor.i).position;
        const auto& p2 = mol.atom(tor.j).position;
        const auto& p3 = mol.atom(tor.k).position;
        const auto& p4 = mol.atom(tor.l).position;

        Eigen::Vector3d b1 = p2 - p1;
        Eigen::Vector3d b2 = p3 - p2;
        Eigen::Vector3d b3 = p4 - p3;

        Eigen::Vector3d n1 = b1.cross(b2);
        Eigen::Vector3d n2 = b2.cross(b3);
        double n1_sq = n1.squaredNorm();
        double n2_sq = n2.squaredNorm();
        if (n1_sq < 1e-20 || n2_sq < 1e-20) continue;

        double b2_norm = b2.norm();
        if (b2_norm < 1e-10) continue;

        double phi = compute_dihedral(p1, p2, p3, p4);

        const auto& pj = get_uff_params(atom_types_[tor.j]);
        const auto& pk = get_uff_params(atom_types_[tor.k]);

        double V = 0.0;
        int n = 3;
        double phi0 = M_PI;

        bool j_sp3 = std::abs(pj.theta0 - 109.47) < 5.0;
        bool k_sp3 = std::abs(pk.theta0 - 109.47) < 5.0;
        bool j_sp2 = std::abs(pj.theta0 - 120.0) < 5.0 || std::abs(pj.theta0 - 111.2) < 5.0;
        bool k_sp2 = std::abs(pk.theta0 - 120.0) < 5.0 || std::abs(pk.theta0 - 111.2) < 5.0;

        if (j_sp3 && k_sp3) {
            n = 3; phi0 = M_PI; V = std::sqrt(std::abs(pj.Vi * pk.Vi));
        } else if (j_sp2 && k_sp2) {
            n = 2; phi0 = M_PI; V = 5.0 * std::sqrt(std::abs(pj.Uj * pk.Uj));
        } else if ((j_sp3 && k_sp2) || (j_sp2 && k_sp3)) {
            n = 6; phi0 = 0.0; V = 1.0;
        } else {
            n = 3; phi0 = M_PI; V = 0.5;
        }

        if (V < 1e-10) continue;

        // dE/dphi = 0.5 * V * n * cos(n*phi0) * sin(n*phi)
        double dE_dphi = 0.5 * V * n * std::cos(n * phi0) * std::sin(n * phi);

        // Torsion gradient using standard formulation
        // dphi/dr_i = -(b2_norm / n1_sq) * n1
        // dphi/dr_l = (b2_norm / n2_sq) * n2
        Eigen::Vector3d dphi_dp1 = -(b2_norm / n1_sq) * n1;
        Eigen::Vector3d dphi_dp4 = (b2_norm / n2_sq) * n2;

        double dot_b1_b2 = b1.dot(b2) / (b2_norm * b2_norm);
        double dot_b3_b2 = b3.dot(b2) / (b2_norm * b2_norm);

        Eigen::Vector3d dphi_dp2 = (dot_b1_b2 - 1.0) * dphi_dp1 - dot_b3_b2 * dphi_dp4;
        Eigen::Vector3d dphi_dp3 = (dot_b3_b2 - 1.0) * dphi_dp4 - dot_b1_b2 * dphi_dp1;

        grad.segment<3>(3*tor.i) += dE_dphi * dphi_dp1;
        grad.segment<3>(3*tor.j) += dE_dphi * dphi_dp2;
        grad.segment<3>(3*tor.k) += dE_dphi * dphi_dp3;
        grad.segment<3>(3*tor.l) += dE_dphi * dphi_dp4;
    }
}

// ============ Van der Waals ============

double UFFForceField::vdw_energy(const Molecule& mol) const {
    double E = 0.0;
    for (const auto& [i, j] : nonbonded_pairs_) {
        const auto& pi = get_uff_params(atom_types_[i]);
        const auto& pj = get_uff_params(atom_types_[j]);

        double x_ij = std::sqrt(pi.x1 * pj.x1); // geometric mean
        double D_ij = std::sqrt(pi.D1 * pj.D1);

        double r = (mol.atom(i).position - mol.atom(j).position).norm();
        if (r < 1e-10) continue;

        double x = x_ij / r;
        double x6 = x * x * x * x * x * x;
        double x12 = x6 * x6;

        E += D_ij * (x12 - 2.0 * x6);
    }
    return E;
}

void UFFForceField::vdw_gradient(const Molecule& mol, Eigen::VectorXd& grad) const {
    for (const auto& [i, j] : nonbonded_pairs_) {
        const auto& pi = get_uff_params(atom_types_[i]);
        const auto& pj = get_uff_params(atom_types_[j]);

        double x_ij = std::sqrt(pi.x1 * pj.x1);
        double D_ij = std::sqrt(pi.D1 * pj.D1);

        Eigen::Vector3d rij = mol.atom(i).position - mol.atom(j).position;
        double r = rij.norm();
        if (r < 1e-10) continue;

        double x = x_ij / r;
        double x6 = x * x * x * x * x * x;
        double x12 = x6 * x6;

        // dE/dr = D_ij * (-12*x12/r + 12*x6/r)
        double dE_dr = D_ij * 12.0 * (-x12 + x6) / r;

        Eigen::Vector3d dE = dE_dr * rij / r;
        grad.segment<3>(3*i) += dE;
        grad.segment<3>(3*j) -= dE;
    }
}

// ============ Public Interface ============

double UFFForceField::calculate_energy(const Molecule& mol) const {
    return bond_stretch_energy(mol) + angle_bend_energy(mol) +
           torsion_energy(mol) + vdw_energy(mol);
}

Eigen::VectorXd UFFForceField::calculate_gradient(const Molecule& mol) const {
    int n = mol.num_atoms() * 3;
    Eigen::VectorXd grad = Eigen::VectorXd::Zero(n);
    bond_stretch_gradient(mol, grad);
    angle_bend_gradient(mol, grad);
    torsion_gradient(mol, grad);
    vdw_gradient(mol, grad);
    return grad;
}

EnergyComponents UFFForceField::calculate_energy_components(const Molecule& mol) const {
    EnergyComponents ec;
    ec.bond_stretch = bond_stretch_energy(mol);
    ec.angle_bend = angle_bend_energy(mol);
    ec.torsion = torsion_energy(mol);
    ec.vdw = vdw_energy(mol);
    ec.total = ec.bond_stretch + ec.angle_bend + ec.torsion + ec.vdw;
    return ec;
}

} // namespace chemsim
