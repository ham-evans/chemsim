import type {
  MoleculeData, MoleculeListItem, CalculationResult,
  CalculationMethodType, DFTSettings, VolumetricData,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Extract a human-readable error message from a FastAPI error response. */
function extractErrorMessage(err: Record<string, unknown>, fallback: string): string {
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join("; ");
  }
  return fallback;
}

export async function uploadMolecule(file: File): Promise<MoleculeData> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/molecules`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractErrorMessage(err, "Upload failed"));
  }
  return res.json();
}

export async function listMolecules(): Promise<MoleculeListItem[]> {
  const res = await fetch(`${API_BASE}/api/molecules`);
  if (!res.ok) throw new Error("Failed to list molecules");
  return res.json();
}

export async function getMolecule(id: string): Promise<MoleculeData> {
  const res = await fetch(`${API_BASE}/api/molecules/${id}`);
  if (!res.ok) throw new Error("Failed to get molecule");
  return res.json();
}

export async function startCalculation(
  moleculeId: string,
  method: CalculationMethodType,
  options: {
    max_iterations?: number;
    grad_tolerance?: number;
    optimizer?: string;
    dft_settings?: DFTSettings;
  } = {}
): Promise<CalculationResult> {
  const { dft_settings, ...rest } = options;
  const res = await fetch(`${API_BASE}/api/calculations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      molecule_id: moleculeId,
      method,
      ...rest,
      ...(dft_settings ? { dft_settings } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractErrorMessage(err, "Calculation failed"));
  }
  return res.json();
}

export async function getCalculation(id: string): Promise<CalculationResult> {
  const res = await fetch(`${API_BASE}/api/calculations/${id}`);
  if (!res.ok) throw new Error("Failed to get calculation");
  return res.json();
}

export async function getOrbitalData(calcId: string, orbitalIndex: number): Promise<VolumetricData> {
  const res = await fetch(`${API_BASE}/api/calculations/${calcId}/orbital/${orbitalIndex}`);
  if (!res.ok) throw new Error("Failed to get orbital data");
  return res.json();
}

export async function getDensityData(calcId: string): Promise<VolumetricData> {
  const res = await fetch(`${API_BASE}/api/calculations/${calcId}/density`);
  if (!res.ok) throw new Error("Failed to get density data");
  return res.json();
}

export async function generateMolecule(description: string): Promise<MoleculeData> {
  const res = await fetch(`${API_BASE}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractErrorMessage(err, "Generation failed"));
  }
  return res.json();
}

export function createCalculationWS(calcId: string): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/api/ws/calculations/${calcId}`);
}
