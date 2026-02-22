#pragma once
#include <functional>
#include <vector>
#include <string>
#include "chemsim/core/molecule.h"
#include "chemsim/ff/uff_energy.h"

namespace chemsim {

struct OptProgress {
    int iteration;
    double energy;
    double grad_norm;
    std::vector<double> positions;
};

using ProgressCallback = std::function<void(const OptProgress&)>;

struct OptResult {
    bool converged;
    int iterations;
    double final_energy;
    double final_grad_norm;
    std::vector<OptProgress> trajectory;
};

struct OptSettings {
    int max_iterations = 500;
    double grad_tolerance = 1e-4;   // kcal/mol/Angstrom
    double energy_tolerance = 1e-8; // kcal/mol
    std::string method = "lbfgs";   // "steepest_descent" or "lbfgs"
    bool store_trajectory = true;
};

// Optimize molecular geometry
OptResult optimize_geometry(
    Molecule& mol,
    UFFForceField& ff,
    const OptSettings& settings = OptSettings{},
    ProgressCallback callback = nullptr
);

} // namespace chemsim
