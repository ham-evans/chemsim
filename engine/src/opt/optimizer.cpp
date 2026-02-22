#include "chemsim/opt/optimizer.h"
#include <LBFGS.h>
#include <cmath>
#include <iostream>

namespace chemsim {

// ============ Steepest Descent ============

static OptResult steepest_descent(Molecule& mol, UFFForceField& ff,
                                   const OptSettings& settings,
                                   ProgressCallback callback) {
    OptResult result;
    result.converged = false;
    result.iterations = 0;

    double step_size = 0.01; // Initial step size in Angstroms
    double prev_energy = ff.calculate_energy(mol);

    for (int iter = 0; iter < settings.max_iterations; ++iter) {
        Eigen::VectorXd grad = ff.calculate_gradient(mol);
        double grad_norm = grad.norm() / std::sqrt(mol.num_atoms());

        // Report progress
        OptProgress prog;
        prog.iteration = iter;
        prog.energy = prev_energy;
        prog.grad_norm = grad_norm;
        if (settings.store_trajectory) {
            prog.positions = mol.get_positions();
        }
        result.trajectory.push_back(prog);
        if (callback) callback(prog);

        // Check convergence
        if (grad_norm < settings.grad_tolerance) {
            result.converged = true;
            result.iterations = iter;
            result.final_energy = prev_energy;
            result.final_grad_norm = grad_norm;
            return result;
        }

        // Backtracking line search
        Eigen::VectorXd direction = -grad;
        direction.normalize();

        double alpha = step_size;
        auto positions = mol.get_positions();

        for (int ls = 0; ls < 20; ++ls) {
            // Trial step
            std::vector<double> trial_pos(positions.size());
            for (size_t i = 0; i < positions.size(); ++i) {
                trial_pos[i] = positions[i] + alpha * direction[i];
            }
            mol.set_positions(trial_pos);
            double trial_energy = ff.calculate_energy(mol);

            if (trial_energy < prev_energy) {
                prev_energy = trial_energy;
                step_size = std::min(alpha * 1.2, 0.5); // grow step
                break;
            } else {
                alpha *= 0.5;
                if (ls == 19) {
                    // Failed line search, restore and try with tiny step
                    mol.set_positions(positions);
                    std::vector<double> tiny_pos(positions.size());
                    for (size_t i = 0; i < positions.size(); ++i) {
                        tiny_pos[i] = positions[i] - 1e-4 * grad[i];
                    }
                    mol.set_positions(tiny_pos);
                    prev_energy = ff.calculate_energy(mol);
                    step_size = 0.001;
                }
            }
        }

        // Energy convergence check
        double energy_change = std::abs(prev_energy - result.trajectory.back().energy);
        if (iter > 0 && energy_change < settings.energy_tolerance) {
            result.converged = true;
            result.iterations = iter;
            result.final_energy = prev_energy;
            result.final_grad_norm = grad_norm;
            return result;
        }
    }

    result.iterations = settings.max_iterations;
    result.final_energy = prev_energy;
    result.final_grad_norm = ff.calculate_gradient(mol).norm() / std::sqrt(mol.num_atoms());
    return result;
}

// ============ L-BFGS ============

class UFFObjective {
public:
    UFFObjective(Molecule& mol, UFFForceField& ff,
                 const OptSettings& settings, ProgressCallback callback)
        : mol_(mol), ff_(ff), settings_(settings), callback_(callback), iter_(0) {}

    double operator()(const Eigen::VectorXd& x, Eigen::VectorXd& grad) {
        // Set positions from x
        std::vector<double> pos(x.data(), x.data() + x.size());
        mol_.set_positions(pos);

        double energy = ff_.calculate_energy(mol_);
        grad = ff_.calculate_gradient(mol_);

        // Report progress
        if (callback_ || settings_.store_trajectory) {
            OptProgress prog;
            prog.iteration = iter_;
            prog.energy = energy;
            prog.grad_norm = grad.norm() / std::sqrt(mol_.num_atoms());
            if (settings_.store_trajectory) {
                prog.positions = pos;
            }
            trajectory_.push_back(prog);
            if (callback_) callback_(prog);
        }
        iter_++;

        return energy;
    }

    int iterations() const { return iter_; }
    const std::vector<OptProgress>& trajectory() const { return trajectory_; }

private:
    Molecule& mol_;
    UFFForceField& ff_;
    const OptSettings& settings_;
    ProgressCallback callback_;
    int iter_;
    std::vector<OptProgress> trajectory_;
};

static OptResult lbfgs_optimize(Molecule& mol, UFFForceField& ff,
                                 const OptSettings& settings,
                                 ProgressCallback callback) {
    LBFGSpp::LBFGSParam<double> param;
    param.max_iterations = settings.max_iterations;
    param.epsilon = settings.grad_tolerance;
    param.past = 1;
    param.delta = settings.energy_tolerance;
    param.max_linesearch = 40;

    LBFGSpp::LBFGSSolver<double> solver(param);
    UFFObjective objective(mol, ff, settings, callback);

    auto positions = mol.get_positions();
    int n = static_cast<int>(positions.size());
    Eigen::VectorXd x = Eigen::Map<Eigen::VectorXd>(positions.data(), n);

    OptResult result;
    try {
        double fx;
        int niter = solver.minimize(objective, x, fx);

        // Set final positions
        std::vector<double> final_pos(x.data(), x.data() + x.size());
        mol.set_positions(final_pos);

        result.converged = true;
        result.iterations = niter;
        result.final_energy = fx;
        result.final_grad_norm = ff.calculate_gradient(mol).norm() / std::sqrt(mol.num_atoms());
    } catch (const std::exception& e) {
        // L-BFGS may throw on convergence failure
        std::vector<double> final_pos(x.data(), x.data() + x.size());
        mol.set_positions(final_pos);

        result.converged = false;
        result.iterations = objective.iterations();
        result.final_energy = ff.calculate_energy(mol);
        result.final_grad_norm = ff.calculate_gradient(mol).norm() / std::sqrt(mol.num_atoms());
    }

    result.trajectory = objective.trajectory();
    return result;
}

// ============ Public Interface ============

OptResult optimize_geometry(Molecule& mol, UFFForceField& ff,
                            const OptSettings& settings,
                            ProgressCallback callback) {
    if (settings.method == "steepest_descent") {
        return steepest_descent(mol, ff, settings, callback);
    } else {
        return lbfgs_optimize(mol, ff, settings, callback);
    }
}

} // namespace chemsim
