#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/eigen.h>
#include <pybind11/functional.h>

#include "chemsim/core/molecule.h"
#include "chemsim/core/element_data.h"
#include "chemsim/io/xyz_parser.h"
#include "chemsim/io/sdf_parser.h"
#include "chemsim/ff/uff_energy.h"
#include "chemsim/ff/uff_typing.h"
#include "chemsim/opt/optimizer.h"

namespace py = pybind11;

PYBIND11_MODULE(chemsim_engine, m) {
    m.doc() = "ChemSim computational chemistry engine";

    // ElementInfo
    py::class_<chemsim::ElementInfo>(m, "ElementInfo")
        .def_readonly("atomic_number", &chemsim::ElementInfo::atomic_number)
        .def_readonly("symbol", &chemsim::ElementInfo::symbol)
        .def_readonly("name", &chemsim::ElementInfo::name)
        .def_readonly("mass", &chemsim::ElementInfo::mass)
        .def_readonly("covalent_radius", &chemsim::ElementInfo::covalent_radius)
        .def_readonly("vdw_radius", &chemsim::ElementInfo::vdw_radius)
        .def_readonly("cpk_color", &chemsim::ElementInfo::cpk_color);

    m.def("element_by_number", &chemsim::element_by_number, py::return_value_policy::reference);
    m.def("element_by_symbol", &chemsim::element_by_symbol, py::return_value_policy::reference);

    // Atom
    py::class_<chemsim::Atom>(m, "Atom")
        .def(py::init<>())
        .def(py::init<int, const std::string&, const Eigen::Vector3d&>())
        .def_readwrite("atomic_number", &chemsim::Atom::atomic_number)
        .def_readwrite("symbol", &chemsim::Atom::symbol)
        .def_readwrite("position", &chemsim::Atom::position);

    // Bond
    py::class_<chemsim::Bond>(m, "Bond")
        .def(py::init<>())
        .def(py::init<int, int, int>())
        .def_readwrite("atom_i", &chemsim::Bond::atom_i)
        .def_readwrite("atom_j", &chemsim::Bond::atom_j)
        .def_readwrite("order", &chemsim::Bond::order);

    // Molecule
    py::class_<chemsim::Molecule>(m, "Molecule")
        .def(py::init<>())
        .def("add_atom", &chemsim::Molecule::add_atom)
        .def("add_bond", &chemsim::Molecule::add_bond)
        .def("perceive_bonds", &chemsim::Molecule::perceive_bonds,
             py::arg("tolerance") = 0.45)
        .def("num_atoms", &chemsim::Molecule::num_atoms)
        .def("num_bonds", &chemsim::Molecule::num_bonds)
        .def("atom", py::overload_cast<int>(&chemsim::Molecule::atom),
             py::return_value_policy::reference_internal)
        .def("bond", &chemsim::Molecule::bond,
             py::return_value_policy::reference_internal)
        .def("atoms", &chemsim::Molecule::atoms,
             py::return_value_policy::reference_internal)
        .def("bonds", &chemsim::Molecule::bonds,
             py::return_value_policy::reference_internal)
        .def("get_positions", &chemsim::Molecule::get_positions)
        .def("set_positions", &chemsim::Molecule::set_positions)
        .def("degree", &chemsim::Molecule::degree)
        .def("bonded_to", &chemsim::Molecule::bonded_to)
        .def("bond_order_between", &chemsim::Molecule::bond_order_between)
        .def_readwrite("name", &chemsim::Molecule::name)
        .def_readwrite("comment", &chemsim::Molecule::comment);

    // Parsers
    m.def("parse_xyz", &chemsim::parse_xyz, "Parse XYZ format string");
    m.def("write_xyz", &chemsim::write_xyz, "Write molecule to XYZ format");
    m.def("parse_sdf", &chemsim::parse_sdf, "Parse SDF/MOL format string");

    // EnergyComponents
    py::class_<chemsim::EnergyComponents>(m, "EnergyComponents")
        .def_readonly("bond_stretch", &chemsim::EnergyComponents::bond_stretch)
        .def_readonly("angle_bend", &chemsim::EnergyComponents::angle_bend)
        .def_readonly("torsion", &chemsim::EnergyComponents::torsion)
        .def_readonly("vdw", &chemsim::EnergyComponents::vdw)
        .def_readonly("total", &chemsim::EnergyComponents::total);

    // UFFForceField
    py::class_<chemsim::UFFForceField>(m, "UFFForceField")
        .def(py::init<>())
        .def("setup", &chemsim::UFFForceField::setup)
        .def("calculate_energy", &chemsim::UFFForceField::calculate_energy)
        .def("calculate_gradient", [](const chemsim::UFFForceField& ff,
                                       const chemsim::Molecule& mol) {
            Eigen::VectorXd grad = ff.calculate_gradient(mol);
            return std::vector<double>(grad.data(), grad.data() + grad.size());
        })
        .def("calculate_energy_components", &chemsim::UFFForceField::calculate_energy_components)
        .def("atom_types", &chemsim::UFFForceField::atom_types);

    // OptProgress
    py::class_<chemsim::OptProgress>(m, "OptProgress")
        .def_readonly("iteration", &chemsim::OptProgress::iteration)
        .def_readonly("energy", &chemsim::OptProgress::energy)
        .def_readonly("grad_norm", &chemsim::OptProgress::grad_norm)
        .def_readonly("positions", &chemsim::OptProgress::positions);

    // OptResult
    py::class_<chemsim::OptResult>(m, "OptResult")
        .def_readonly("converged", &chemsim::OptResult::converged)
        .def_readonly("iterations", &chemsim::OptResult::iterations)
        .def_readonly("final_energy", &chemsim::OptResult::final_energy)
        .def_readonly("final_grad_norm", &chemsim::OptResult::final_grad_norm)
        .def_readonly("trajectory", &chemsim::OptResult::trajectory);

    // OptSettings
    py::class_<chemsim::OptSettings>(m, "OptSettings")
        .def(py::init<>())
        .def_readwrite("max_iterations", &chemsim::OptSettings::max_iterations)
        .def_readwrite("grad_tolerance", &chemsim::OptSettings::grad_tolerance)
        .def_readwrite("energy_tolerance", &chemsim::OptSettings::energy_tolerance)
        .def_readwrite("method", &chemsim::OptSettings::method)
        .def_readwrite("store_trajectory", &chemsim::OptSettings::store_trajectory);

    // Optimizer
    m.def("optimize_geometry", [](chemsim::Molecule& mol, chemsim::UFFForceField& ff,
                                   const chemsim::OptSettings& settings,
                                   py::object callback) {
        chemsim::ProgressCallback cpp_callback = nullptr;
        if (!callback.is_none()) {
            cpp_callback = [callback](const chemsim::OptProgress& prog) {
                py::gil_scoped_acquire acquire;
                callback(prog);
            };
        }
        py::gil_scoped_release release;
        return chemsim::optimize_geometry(mol, ff, settings, cpp_callback);
    }, py::arg("mol"), py::arg("ff"),
       py::arg("settings") = chemsim::OptSettings{},
       py::arg("callback") = py::none());
}
