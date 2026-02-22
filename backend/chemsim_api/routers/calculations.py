"""Calculation endpoints."""
import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException

from chemsim_api.models.schemas import (
    CalculationRequest, CalculationResponse, CalculationStatus,
    CalculationMethod, EnergyComponentsResponse,
    DFTPropertiesResponse, FrequencyResponse,
)
from chemsim_api.store import (
    store_calculation, get_calculation, get_molecule, get_dft_result,
)
from chemsim_api.services.computation import create_queue
from chemsim_api.services.dft_runner import (
    start_dft_energy, start_dft_optimization, start_dft_frequency,
)

router = APIRouter(prefix="/api/calculations", tags=["calculations"])
_viz_executor = ThreadPoolExecutor(max_workers=2)


@router.post("", response_model=CalculationResponse)
async def create_calculation(request: CalculationRequest):
    mol = get_molecule(request.molecule_id)
    if mol is None:
        raise HTTPException(status_code=404, detail="Molecule not found")

    calc_id = str(uuid.uuid4())[:8]
    store_calculation(calc_id, {
        "id": calc_id,
        "molecule_id": request.molecule_id,
        "method": request.method.value,
        "status": CalculationStatus.PENDING,
    })

    if request.method == CalculationMethod.DFT_ENERGY:
        ds = request.dft_settings or _default_dft()
        await start_dft_energy(
            calc_id, request.molecule_id,
            ds.functional, ds.basis_set, ds.charge, ds.spin,
        )

    elif request.method == CalculationMethod.DFT_OPTIMIZE:
        ds = request.dft_settings or _default_dft()
        create_queue(calc_id)
        await start_dft_optimization(
            calc_id, request.molecule_id,
            ds.functional, ds.basis_set, ds.charge, ds.spin,
            request.max_iterations, request.grad_tolerance,
        )

    elif request.method == CalculationMethod.DFT_FREQUENCY:
        ds = request.dft_settings or _default_dft()
        await start_dft_frequency(
            calc_id, request.molecule_id,
            ds.functional, ds.basis_set, ds.charge, ds.spin,
        )

    data = get_calculation(calc_id)
    return _calc_data_to_response(data)


@router.get("/{calc_id}", response_model=CalculationResponse)
async def get_calculation_by_id(calc_id: str):
    data = get_calculation(calc_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return _calc_data_to_response(data)


@router.get("/{calc_id}/orbital/{orbital_index}")
async def get_orbital_data(calc_id: str, orbital_index: int):
    cached = get_dft_result(calc_id)
    if cached is None:
        raise HTTPException(status_code=404, detail="No DFT result cached for this calculation")
    mf, pmol = cached

    from chemsim_api.services.dft_computation import generate_orbital_cube_data
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(
        _viz_executor, generate_orbital_cube_data, mf, pmol, orbital_index
    )
    return data


@router.get("/{calc_id}/density")
async def get_density_data(calc_id: str):
    cached = get_dft_result(calc_id)
    if cached is None:
        raise HTTPException(status_code=404, detail="No DFT result cached for this calculation")
    mf, pmol = cached

    from chemsim_api.services.dft_computation import generate_density_cube_data
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(
        _viz_executor, generate_density_cube_data, mf, pmol
    )
    return data


def _default_dft():
    from chemsim_api.models.schemas import DFTSettings
    return DFTSettings()


def _calc_data_to_response(data: dict) -> CalculationResponse:
    ec = data.get("energy_components")
    ec_resp = None
    if ec:
        ec_resp = EnergyComponentsResponse(**ec)

    dp = data.get("dft_properties")
    dp_resp = None
    if dp:
        dp_resp = DFTPropertiesResponse(**dp)

    freq = data.get("frequencies")
    freq_resp = None
    if freq:
        freq_resp = FrequencyResponse(**freq)

    return CalculationResponse(
        id=data["id"],
        molecule_id=data["molecule_id"],
        method=data["method"],
        status=data["status"],
        energy=data.get("energy"),
        energy_components=ec_resp,
        dft_properties=dp_resp,
        frequencies=freq_resp,
        converged=data.get("converged"),
        iterations=data.get("iterations"),
        final_grad_norm=data.get("final_grad_norm"),
        optimized_positions=data.get("optimized_positions"),
        error=data.get("error"),
    )
