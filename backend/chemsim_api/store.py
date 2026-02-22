"""In-memory storage for molecules and calculations (MVP)."""
import sys
import os

# Add engine build directory to path for chemsim_engine import
ENGINE_BUILD = os.path.join(os.path.dirname(__file__), '..', '..', 'engine', 'build')
if os.path.exists(ENGINE_BUILD):
    sys.path.insert(0, os.path.abspath(ENGINE_BUILD))

import chemsim_engine

_molecules: dict[str, chemsim_engine.Molecule] = {}
_molecule_names: dict[str, str] = {}
_calculations: dict[str, dict] = {}
_dft_mf_cache: dict[str, tuple] = {}  # calc_id -> (mf, pmol)


def store_molecule(mol_id: str, mol: chemsim_engine.Molecule, name: str = ""):
    _molecules[mol_id] = mol
    _molecule_names[mol_id] = name


def get_molecule(mol_id: str) -> chemsim_engine.Molecule | None:
    return _molecules.get(mol_id)


def get_molecule_name(mol_id: str) -> str:
    return _molecule_names.get(mol_id, "")


def list_molecules() -> list[tuple[str, chemsim_engine.Molecule, str]]:
    return [(mid, mol, _molecule_names.get(mid, ""))
            for mid, mol in _molecules.items()]


def store_calculation(calc_id: str, data: dict):
    _calculations[calc_id] = data


def get_calculation(calc_id: str) -> dict | None:
    return _calculations.get(calc_id)


def update_calculation(calc_id: str, **kwargs):
    if calc_id in _calculations:
        _calculations[calc_id].update(kwargs)


def cache_dft_result(calc_id: str, mf, pmol):
    _dft_mf_cache[calc_id] = (mf, pmol)


def get_dft_result(calc_id: str):
    return _dft_mf_cache.get(calc_id)
