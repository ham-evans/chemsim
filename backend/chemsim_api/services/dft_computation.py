"""PySCF DFT computation wrapper."""
import base64
import numpy as np
from pyscf import gto, dft, hessian
from pyscf.geomopt.geometric_solver import optimize as geometric_optimize

import chemsim_engine

# Bohr to Angstrom conversion
BOHR_TO_ANG = 0.529177249
HARTREE_TO_EV = 27.211386245988


def chemsim_mol_to_pyscf(mol: chemsim_engine.Molecule, charge: int = 0,
                         spin: int = 0, basis: str = "6-31g*") -> gto.Mole:
    """Convert chemsim_engine.Molecule to pyscf.gto.Mole."""
    positions = mol.get_positions()
    num_atoms = mol.num_atoms()
    atoms = []
    for i in range(num_atoms):
        a = mol.atom(i)
        x, y, z = positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]
        atoms.append((a.symbol, (x, y, z)))

    pmol = gto.Mole()
    pmol.atom = atoms
    pmol.basis = basis
    pmol.charge = charge
    pmol.spin = spin
    pmol.unit = "Angstrom"
    pmol.verbose = 0
    pmol.build()
    return pmol


def run_dft_energy(pmol: gto.Mole, functional: str = "b3lyp"):
    """Run DFT single-point energy calculation. Returns (mf, energy)."""
    if pmol.spin > 0:
        mf = dft.UKS(pmol)
    else:
        mf = dft.RKS(pmol)
    mf.xc = functional
    mf.verbose = 0
    energy = mf.kernel()
    return mf, energy


def extract_properties(mf, pmol: gto.Mole) -> dict:
    """Extract electronic properties from converged DFT calculation."""
    # Orbital energies in eV
    mo_energies_ev = (mf.mo_energy * HARTREE_TO_EV).tolist()

    # Occupation-based HOMO/LUMO
    mo_occ = mf.mo_occ
    occupied = np.where(mo_occ > 0)[0]
    virtual = np.where(mo_occ == 0)[0]

    homo_index = int(occupied[-1]) if len(occupied) > 0 else 0
    lumo_index = int(virtual[0]) if len(virtual) > 0 else len(mo_energies_ev) - 1

    homo_energy = mo_energies_ev[homo_index]
    lumo_energy = mo_energies_ev[lumo_index]
    gap = lumo_energy - homo_energy

    # Mulliken charges
    mulliken_result = mf.mulliken_pop(verbose=0)
    charges = mulliken_result[1].tolist()

    # Dipole moment (Debye)
    dipole = mf.dip_moment(verbose=0).tolist()
    dipole_mag = float(np.linalg.norm(dipole))

    return {
        "mo_energies_ev": mo_energies_ev,
        "homo_index": homo_index,
        "lumo_index": lumo_index,
        "homo_lumo_gap_ev": gap,
        "mulliken_charges": charges,
        "dipole": dipole,
        "dipole_magnitude": dipole_mag,
    }


def run_dft_optimization(pmol: gto.Mole, functional: str = "b3lyp",
                         max_iterations: int = 100, grad_tolerance: float = 1e-4,
                         progress_callback=None):
    """Run DFT geometry optimization using geomeTRIC. Returns (mf, optimized_pmol)."""
    if pmol.spin > 0:
        mf = dft.UKS(pmol)
    else:
        mf = dft.RKS(pmol)
    mf.xc = functional
    mf.verbose = 0

    iteration_count = [0]

    def callback(envs):
        iteration_count[0] += 1
        if progress_callback:
            # envs contains 'energy' and 'gradients'
            energy = envs.get("energy", 0.0)
            grad = envs.get("gradients", None)
            grad_norm = float(np.linalg.norm(grad)) if grad is not None else 0.0
            # Get current coordinates in Angstrom
            coords_bohr = envs.get("coords", None)
            positions = []
            if coords_bohr is not None:
                coords_ang = coords_bohr * BOHR_TO_ANG
                positions = coords_ang.flatten().tolist()
            progress_callback(iteration_count[0], energy, grad_norm, positions)

    conv_params = {
        "maxsteps": max_iterations,
        "convergence_grms": grad_tolerance,
    }

    opt_pmol = geometric_optimize(mf, callback=callback, **conv_params)
    return mf, opt_pmol


def run_frequency_analysis(mf, pmol: gto.Mole) -> dict:
    """Compute vibrational frequencies via Hessian diagonalization."""
    if pmol.spin > 0:
        hess_obj = hessian.uks.Hessian(mf)
    else:
        hess_obj = hessian.rks.Hessian(mf)

    hess_matrix = hess_obj.kernel()
    natom = pmol.natm
    # hess_matrix shape: (natom, 3, natom, 3) -> reshape to (3*natom, 3*natom)
    hess_2d = hess_matrix.transpose(0, 1, 2, 3).reshape(3 * natom, 3 * natom)

    # Mass-weight the Hessian
    masses = pmol.atom_mass_list()
    mass_weights = np.repeat(masses, 3)
    mass_sqrt_inv = 1.0 / np.sqrt(mass_weights)
    hess_mw = hess_2d * np.outer(mass_sqrt_inv, mass_sqrt_inv)

    # Diagonalize
    eigenvalues, eigenvectors = np.linalg.eigh(hess_mw)

    # Convert eigenvalues to cm^-1
    # E_h / (a_0^2 * m_e) -> s^-2, then to cm^-1
    HARTREE_TO_J = 4.3597447222071e-18
    BOHR_TO_M = 5.29177210903e-11
    AMU_TO_KG = 1.66053906660e-27
    C_CM = 2.99792458e10  # speed of light in cm/s

    conv = HARTREE_TO_J / (BOHR_TO_M ** 2 * AMU_TO_KG)
    frequencies = []
    for ev in eigenvalues:
        if ev >= 0:
            freq_hz = np.sqrt(ev * conv)
        else:
            freq_hz = -np.sqrt(-ev * conv)  # imaginary frequency
        freq_cm1 = freq_hz / (2 * np.pi * C_CM)
        frequencies.append(float(freq_cm1))

    # Un-mass-weight eigenvectors to get Cartesian displacements
    normal_modes = []
    for i in range(len(eigenvalues)):
        mode = eigenvectors[:, i] * mass_sqrt_inv
        # Normalize
        norm = np.linalg.norm(mode)
        if norm > 1e-10:
            mode = mode / norm
        normal_modes.append(mode.tolist())

    num_imaginary = sum(1 for f in frequencies if f < 0)

    return {
        "frequencies_cm1": frequencies,
        "num_frequencies": len(frequencies),
        "num_imaginary": num_imaginary,
        "normal_modes": normal_modes,
    }


def generate_orbital_cube_data(mf, pmol: gto.Mole, orbital_index: int,
                               grid_points: int = 60, padding: float = 4.0) -> dict:
    """Generate volumetric orbital data on a 3D grid."""
    coords_bohr = pmol.atom_coords()  # in Bohr
    coords_ang = coords_bohr * BOHR_TO_ANG

    # Grid bounds in Angstrom
    mins = coords_ang.min(axis=0) - padding
    maxs = coords_ang.max(axis=0) + padding

    # Create grid points in Angstrom
    x = np.linspace(mins[0], maxs[0], grid_points)
    y = np.linspace(mins[1], maxs[1], grid_points)
    z = np.linspace(mins[2], maxs[2], grid_points)

    # Meshgrid -> flat list of points
    xx, yy, zz = np.meshgrid(x, y, z, indexing="ij")
    grid_coords_ang = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()])

    # Convert to Bohr for PySCF
    grid_coords_bohr = grid_coords_ang / BOHR_TO_ANG

    # Evaluate AOs on grid
    ao_values = pmol.eval_gto("GTOval", grid_coords_bohr)  # (npts, nao)

    # Get MO coefficients
    mo_coeff = mf.mo_coeff
    if mo_coeff.ndim == 3:  # UKS: alpha and beta
        mo_coeff = mo_coeff[0]  # use alpha orbitals

    # MO value = AO @ MO_coeff[:, orbital_index]
    orbital_values = ao_values @ mo_coeff[:, orbital_index]

    # Encode as base64 float32
    data_f32 = orbital_values.astype(np.float32)
    encoded = base64.b64encode(data_f32.tobytes()).decode("ascii")

    return {
        "nx": grid_points, "ny": grid_points, "nz": grid_points,
        "origin": mins.tolist(),
        "extent": (maxs - mins).tolist(),
        "data_base64": encoded,
    }


def generate_density_cube_data(mf, pmol: gto.Mole,
                               grid_points: int = 60, padding: float = 4.0) -> dict:
    """Generate electron density on a 3D grid."""
    coords_bohr = pmol.atom_coords()
    coords_ang = coords_bohr * BOHR_TO_ANG

    mins = coords_ang.min(axis=0) - padding
    maxs = coords_ang.max(axis=0) + padding

    x = np.linspace(mins[0], maxs[0], grid_points)
    y = np.linspace(mins[1], maxs[1], grid_points)
    z = np.linspace(mins[2], maxs[2], grid_points)

    xx, yy, zz = np.meshgrid(x, y, z, indexing="ij")
    grid_coords_ang = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()])
    grid_coords_bohr = grid_coords_ang / BOHR_TO_ANG

    ao_values = pmol.eval_gto("GTOval", grid_coords_bohr)

    # Density matrix
    dm = mf.make_rdm1()
    if dm.ndim == 3:  # UKS
        dm = dm[0] + dm[1]

    # rho(r) = sum_ij AO_i(r) * DM_ij * AO_j(r)
    density = np.einsum("gi,ij,gj->g", ao_values, dm, ao_values)

    data_f32 = density.astype(np.float32)
    encoded = base64.b64encode(data_f32.tobytes()).decode("ascii")

    return {
        "nx": grid_points, "ny": grid_points, "nz": grid_points,
        "origin": mins.tolist(),
        "extent": (maxs - mins).tolist(),
        "data_base64": encoded,
    }
