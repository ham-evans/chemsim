"""AI-powered molecule generation: GPT-4o for SMILES, RDKit for 3D geometry."""
import os
import re

from openai import AsyncOpenAI
from rdkit import Chem
from rdkit.Chem import AllChem

SYSTEM_PROMPT = """\
You are a chemistry assistant. Given a molecule description (name, formula, SMILES, \
or other identifier), respond with ONLY the canonical SMILES string for that molecule.

Rules:
- Output ONLY the SMILES string, nothing else
- No commentary, no labels, no markdown
- Use canonical SMILES notation
- If given a SMILES string, just return it as-is
"""

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


async def get_smiles(description: str) -> str:
    """Use GPT-4o to convert a molecule description to a SMILES string."""
    client = _get_client()
    response = await client.chat.completions.create(
        model="gpt-5.2",
        temperature=0.0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": description},
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    # Strip markdown fences if present
    content = re.sub(r"^```\w*\n?", "", content)
    content = re.sub(r"\n?```$", "", content)
    return content.strip()


def smiles_to_xyz(smiles: str, name: str = "molecule") -> str:
    """Convert a SMILES string to XYZ format using RDKit 3D embedding."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    # Add explicit hydrogens
    mol = Chem.AddHs(mol)

    # Generate 3D coordinates with ETKDG
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    result = AllChem.EmbedMolecule(mol, params)
    if result == -1:
        # Fallback: try without distance geometry constraints
        result = AllChem.EmbedMolecule(mol, randomSeed=42)
        if result == -1:
            raise ValueError(f"Could not generate 3D coordinates for: {smiles}")

    # Optimize with MMFF94 force field
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=500)
    except Exception:
        pass  # Use unoptimized coords if MMFF fails

    # Convert to XYZ string
    conf = mol.GetConformer()
    num_atoms = mol.GetNumAtoms()
    lines = [str(num_atoms), name]
    for i in range(num_atoms):
        atom = mol.GetAtomWithIdx(i)
        pos = conf.GetAtomPosition(i)
        symbol = atom.GetSymbol()
        lines.append(f"{symbol}  {pos.x: .6f}  {pos.y: .6f}  {pos.z: .6f}")

    return "\n".join(lines)
