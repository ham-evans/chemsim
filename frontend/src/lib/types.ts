export interface Atom {
  index: number;
  symbol: string;
  atomic_number: number;
  position: [number, number, number];
}

export interface Bond {
  atom_i: number;
  atom_j: number;
  order: number;
}

export interface MoleculeData {
  id: string;
  name: string;
  comment: string;
  num_atoms: number;
  num_bonds: number;
  atoms: Atom[];
  bonds: Bond[];
}

export interface MoleculeListItem {
  id: string;
  name: string;
  num_atoms: number;
  num_bonds: number;
}

export interface EnergyComponents {
  bond_stretch: number;
  angle_bend: number;
  torsion: number;
  vdw: number;
  total: number;
}

export interface DFTSettings {
  functional: string;
  basis_set: string;
  charge: number;
  spin: number;
}

export interface DFTProperties {
  mo_energies_ev: number[];
  homo_index: number;
  lumo_index: number;
  homo_lumo_gap_ev: number;
  mulliken_charges: number[];
  dipole: number[];
  dipole_magnitude: number;
}

export interface FrequencyResult {
  frequencies_cm1: number[];
  num_frequencies: number;
  num_imaginary: number;
  normal_modes: number[][];
}

export interface VolumetricData {
  nx: number;
  ny: number;
  nz: number;
  origin: number[];
  extent: number[];
  data_base64: string;
}

export type CalculationMethodType =
  | "dft_energy"
  | "dft_optimize"
  | "dft_frequency";

export interface CalculationResult {
  id: string;
  molecule_id: string;
  method: string;
  status: "pending" | "running" | "completed" | "failed";
  energy: number | null;
  energy_components: EnergyComponents | null;
  dft_properties: DFTProperties | null;
  frequencies: FrequencyResult | null;
  converged: boolean | null;
  iterations: number | null;
  final_grad_norm: number | null;
  optimized_positions: number[] | null;
  error: string | null;
}

export interface ProgressMessage {
  type: "progress";
  calculation_id: string;
  iteration: number;
  energy: number;
  grad_norm: number;
  positions: number[];
}

export interface CompletionMessage {
  type: "completed";
  calculation_id: string;
  converged: boolean;
  iterations: number;
  final_energy: number;
  final_grad_norm: number;
  energy_components?: EnergyComponents;
  dft_properties?: DFTProperties;
  positions: number[];
}

export interface ErrorMessage {
  type: "error";
  calculation_id: string;
  error: string;
}

export type WSMessage = ProgressMessage | CompletionMessage | ErrorMessage | { type: "heartbeat" };
