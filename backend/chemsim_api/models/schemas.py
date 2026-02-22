from pydantic import BaseModel
from enum import Enum
from typing import Optional


class AtomResponse(BaseModel):
    index: int
    symbol: str
    atomic_number: int
    position: list[float]  # [x, y, z]


class BondResponse(BaseModel):
    atom_i: int
    atom_j: int
    order: int


class MoleculeResponse(BaseModel):
    id: str
    name: str
    comment: str
    num_atoms: int
    num_bonds: int
    atoms: list[AtomResponse]
    bonds: list[BondResponse]


class MoleculeListItem(BaseModel):
    id: str
    name: str
    num_atoms: int
    num_bonds: int


class CalculationMethod(str, Enum):
    DFT_ENERGY = "dft_energy"
    DFT_OPTIMIZE = "dft_optimize"
    DFT_FREQUENCY = "dft_frequency"


class DFTSettings(BaseModel):
    functional: str = "b3lyp"
    basis_set: str = "6-31g*"
    charge: int = 0
    spin: int = 0


class CalculationRequest(BaseModel):
    molecule_id: str
    method: CalculationMethod
    max_iterations: int = 500
    grad_tolerance: float = 1e-4
    optimizer: str = "lbfgs"  # "lbfgs" or "steepest_descent"
    dft_settings: Optional[DFTSettings] = None


class EnergyComponentsResponse(BaseModel):
    bond_stretch: float
    angle_bend: float
    torsion: float
    vdw: float
    total: float


class CalculationStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DFTPropertiesResponse(BaseModel):
    mo_energies_ev: list[float]
    homo_index: int
    lumo_index: int
    homo_lumo_gap_ev: float
    mulliken_charges: list[float]
    dipole: list[float]  # [x, y, z] in Debye
    dipole_magnitude: float


class FrequencyResponse(BaseModel):
    frequencies_cm1: list[float]
    num_frequencies: int
    num_imaginary: int
    normal_modes: list[list[float]]  # each mode is [dx1,dy1,dz1,dx2,dy2,dz2,...]


class CalculationResponse(BaseModel):
    id: str
    molecule_id: str
    method: str
    status: CalculationStatus
    energy: Optional[float] = None
    energy_components: Optional[EnergyComponentsResponse] = None
    dft_properties: Optional[DFTPropertiesResponse] = None
    frequencies: Optional[FrequencyResponse] = None
    converged: Optional[bool] = None
    iterations: Optional[int] = None
    final_grad_norm: Optional[float] = None
    optimized_positions: Optional[list[float]] = None
    error: Optional[str] = None


class ProgressMessage(BaseModel):
    type: str = "progress"
    calculation_id: str
    iteration: int
    energy: float
    grad_norm: float
    positions: list[float]


class CompletionMessage(BaseModel):
    type: str = "completed"
    calculation_id: str
    converged: bool
    iterations: int
    final_energy: float
    final_grad_norm: float
    energy_components: Optional[EnergyComponentsResponse] = None
    dft_properties: Optional[DFTPropertiesResponse] = None
    positions: list[float]


class ErrorMessage(BaseModel):
    type: str = "error"
    calculation_id: str
    error: str
