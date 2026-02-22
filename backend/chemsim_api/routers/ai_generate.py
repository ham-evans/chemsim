"""AI molecule generation endpoint."""
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import chemsim_engine

from chemsim_api.models.schemas import MoleculeResponse
from chemsim_api.routers.molecules import molecule_to_response
from chemsim_api.services.ai_generate import get_smiles, smiles_to_xyz
from chemsim_api.store import store_molecule

router = APIRouter(prefix="/api/ai", tags=["ai"])


class GenerateRequest(BaseModel):
    description: str


@router.post("/generate", response_model=MoleculeResponse)
async def generate_molecule(req: GenerateRequest):
    description = req.description.strip()
    if not description:
        raise HTTPException(status_code=400, detail="Description cannot be empty")

    # Step 1: GPT-4o converts description → SMILES
    try:
        smiles = await get_smiles(description)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")

    # Step 2: RDKit converts SMILES → optimized 3D XYZ
    try:
        xyz_text = smiles_to_xyz(smiles, name=description)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Step 3: Parse into our engine
    try:
        mol = chemsim_engine.parse_xyz(xyz_text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse generated XYZ: {e}")

    mol_id = str(uuid.uuid4())[:8]
    name = description[:60]
    mol.name = name
    store_molecule(mol_id, mol, name)

    return molecule_to_response(mol_id, mol, name)
