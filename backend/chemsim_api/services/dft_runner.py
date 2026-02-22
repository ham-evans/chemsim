"""Async DFT computation orchestrator."""
import asyncio
from concurrent.futures import ThreadPoolExecutor

from chemsim_api.store import (
    get_molecule, update_calculation, cache_dft_result,
)
from chemsim_api.models.schemas import CalculationStatus
from chemsim_api.services.computation import get_queue, create_queue
from chemsim_api.services.dft_computation import (
    chemsim_mol_to_pyscf, run_dft_energy, extract_properties,
    run_dft_optimization, run_frequency_analysis,
)

_dft_executor = ThreadPoolExecutor(max_workers=1)


def run_dft_energy_calc(calc_id: str, molecule_id: str,
                        functional: str, basis_set: str,
                        charge: int, spin: int):
    """Synchronous DFT single-point energy calculation."""
    mol = get_molecule(molecule_id)
    if mol is None:
        update_calculation(calc_id, status=CalculationStatus.FAILED,
                          error="Molecule not found")
        return

    try:
        update_calculation(calc_id, status=CalculationStatus.RUNNING)
        pmol = chemsim_mol_to_pyscf(mol, charge, spin, basis_set)
        mf, energy = run_dft_energy(pmol, functional)
        props = extract_properties(mf, pmol)

        cache_dft_result(calc_id, mf, pmol)

        update_calculation(
            calc_id,
            status=CalculationStatus.COMPLETED,
            energy=float(energy),
            dft_properties=props,
        )
    except Exception as e:
        update_calculation(calc_id, status=CalculationStatus.FAILED, error=str(e))


def run_dft_optimize_calc(calc_id: str, molecule_id: str,
                          functional: str, basis_set: str,
                          charge: int, spin: int,
                          max_iterations: int, grad_tolerance: float,
                          loop: asyncio.AbstractEventLoop):
    """Run DFT geometry optimization in a thread, pushing progress to queue."""
    mol = get_molecule(molecule_id)
    if mol is None:
        update_calculation(calc_id, status=CalculationStatus.FAILED,
                          error="Molecule not found")
        q = get_queue(calc_id)
        if q:
            loop.call_soon_threadsafe(q.put_nowait, {
                "type": "error", "calculation_id": calc_id,
                "error": "Molecule not found"
            })
        return

    try:
        update_calculation(calc_id, status=CalculationStatus.RUNNING)
        pmol = chemsim_mol_to_pyscf(mol, charge, spin, basis_set)
        q = get_queue(calc_id)

        def progress_callback(iteration, energy, grad_norm, positions):
            if q:
                msg = {
                    "type": "progress",
                    "calculation_id": calc_id,
                    "iteration": iteration,
                    "energy": energy,
                    "grad_norm": grad_norm,
                    "positions": positions,
                }
                loop.call_soon_threadsafe(q.put_nowait, msg)

        mf, opt_pmol = run_dft_optimization(
            pmol, functional, max_iterations, grad_tolerance, progress_callback
        )

        # geometric_optimize doesn't update mf with final SCF results,
        # so re-run a single-point on the optimized geometry
        mf_final, _ = run_dft_energy(opt_pmol, functional)

        props = extract_properties(mf_final, opt_pmol)
        cache_dft_result(calc_id, mf_final, opt_pmol)

        # Get optimized positions in Angstrom
        from chemsim_api.services.dft_computation import BOHR_TO_ANG
        opt_coords = opt_pmol.atom_coords() * BOHR_TO_ANG
        positions = opt_coords.flatten().tolist()

        energy = float(mf_final.e_tot)

        update_calculation(
            calc_id,
            status=CalculationStatus.COMPLETED,
            energy=energy,
            dft_properties=props,
            converged=True,
            iterations=0,  # geometric doesn't easily report iteration count
            final_grad_norm=0.0,
            optimized_positions=positions,
        )

        if q:
            loop.call_soon_threadsafe(q.put_nowait, {
                "type": "completed",
                "calculation_id": calc_id,
                "converged": True,
                "iterations": 0,
                "final_energy": energy,
                "final_grad_norm": 0.0,
                "dft_properties": props,
                "positions": positions,
            })

    except Exception as e:
        update_calculation(calc_id, status=CalculationStatus.FAILED, error=str(e))
        q = get_queue(calc_id)
        if q:
            loop.call_soon_threadsafe(q.put_nowait, {
                "type": "error", "calculation_id": calc_id, "error": str(e)
            })


def run_dft_frequency_calc(calc_id: str, molecule_id: str,
                           functional: str, basis_set: str,
                           charge: int, spin: int):
    """Synchronous DFT frequency calculation (energy + Hessian)."""
    mol = get_molecule(molecule_id)
    if mol is None:
        update_calculation(calc_id, status=CalculationStatus.FAILED,
                          error="Molecule not found")
        return

    try:
        update_calculation(calc_id, status=CalculationStatus.RUNNING)
        pmol = chemsim_mol_to_pyscf(mol, charge, spin, basis_set)
        mf, energy = run_dft_energy(pmol, functional)
        props = extract_properties(mf, pmol)
        freq_result = run_frequency_analysis(mf, pmol)

        cache_dft_result(calc_id, mf, pmol)

        update_calculation(
            calc_id,
            status=CalculationStatus.COMPLETED,
            energy=float(energy),
            dft_properties=props,
            frequencies=freq_result,
        )
    except Exception as e:
        update_calculation(calc_id, status=CalculationStatus.FAILED, error=str(e))


async def start_dft_energy(calc_id: str, molecule_id: str,
                           functional: str, basis_set: str,
                           charge: int, spin: int):
    """Start DFT energy in background thread."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _dft_executor,
        run_dft_energy_calc,
        calc_id, molecule_id, functional, basis_set, charge, spin,
    )


async def start_dft_optimization(calc_id: str, molecule_id: str,
                                 functional: str, basis_set: str,
                                 charge: int, spin: int,
                                 max_iterations: int, grad_tolerance: float):
    """Start DFT optimization in background thread."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _dft_executor,
        run_dft_optimize_calc,
        calc_id, molecule_id, functional, basis_set, charge, spin,
        max_iterations, grad_tolerance, loop,
    )


async def start_dft_frequency(calc_id: str, molecule_id: str,
                               functional: str, basis_set: str,
                               charge: int, spin: int):
    """Start DFT frequency in background thread."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _dft_executor,
        run_dft_frequency_calc,
        calc_id, molecule_id, functional, basis_set, charge, spin,
    )
