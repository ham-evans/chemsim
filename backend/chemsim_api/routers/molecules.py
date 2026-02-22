"""Molecule upload and retrieval endpoints."""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException

import chemsim_engine

from chemsim_api.models.schemas import (
    MoleculeResponse, MoleculeListItem, AtomResponse, BondResponse,
)
from chemsim_api.store import store_molecule, get_molecule, get_molecule_name, list_molecules

router = APIRouter(prefix="/api/molecules", tags=["molecules"])


def molecule_to_response(mol_id: str, mol: chemsim_engine.Molecule, name: str) -> MoleculeResponse:
    atoms = []
    for i in range(mol.num_atoms()):
        a = mol.atom(i)
        atoms.append(AtomResponse(
            index=i,
            symbol=a.symbol,
            atomic_number=a.atomic_number,
            position=list(a.position),
        ))
    bonds = []
    for i in range(mol.num_bonds()):
        b = mol.bond(i)
        bonds.append(BondResponse(atom_i=b.atom_i, atom_j=b.atom_j, order=b.order))

    return MoleculeResponse(
        id=mol_id,
        name=name,
        comment=mol.comment,
        num_atoms=mol.num_atoms(),
        num_bonds=mol.num_bonds(),
        atoms=atoms,
        bonds=bonds,
    )


@router.post("", response_model=MoleculeResponse)
async def upload_molecule(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")
    filename = file.filename or "molecule"

    try:
        if filename.endswith(".sdf") or filename.endswith(".mol"):
            mol = chemsim_engine.parse_sdf(text)
        else:
            mol = chemsim_engine.parse_xyz(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {str(e)}")

    mol_id = str(uuid.uuid4())[:8]
    name = filename.rsplit(".", 1)[0] if "." in filename else filename
    mol.name = name
    store_molecule(mol_id, mol, name)

    return molecule_to_response(mol_id, mol, name)


@router.get("", response_model=list[MoleculeListItem])
async def list_all_molecules():
    items = []
    for mol_id, mol, name in list_molecules():
        items.append(MoleculeListItem(
            id=mol_id, name=name,
            num_atoms=mol.num_atoms(), num_bonds=mol.num_bonds(),
        ))
    return items


@router.get("/{mol_id}", response_model=MoleculeResponse)
async def get_molecule_by_id(mol_id: str):
    mol = get_molecule(mol_id)
    if mol is None:
        raise HTTPException(status_code=404, detail="Molecule not found")
    name = get_molecule_name(mol_id)
    return molecule_to_response(mol_id, mol, name)
