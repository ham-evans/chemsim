import { create } from "zustand";
import type {
  MoleculeData,
  MoleculeListItem,
  EnergyComponents,
  DFTSettings,
  DFTProperties,
  FrequencyResult,
  VolumetricData,
  CalculationMethodType,
} from "@/lib/types";

interface EnergyPoint {
  iteration: number;
  energy: number;
  grad_norm: number;
}

interface AppState {
  // Molecules
  molecules: MoleculeListItem[];
  activeMolecule: MoleculeData | null;
  selectedAtomIndex: number | null;

  // Calculation
  calculationId: string | null;
  calculationStatus: "idle" | "running" | "completed" | "failed";
  calculationMethod: CalculationMethodType;
  energyComponents: EnergyComponents | null;
  initialEnergy: number | null;
  energyHistory: EnergyPoint[];
  converged: boolean | null;
  iterations: number | null;
  error: string | null;

  // DFT
  dftSettings: DFTSettings;
  dftProperties: DFTProperties | null;
  frequencies: FrequencyResult | null;

  // Orbital/Density visualization
  orbitalData: VolumetricData | null;
  densityData: VolumetricData | null;
  selectedOrbitalIndex: number | null;
  showOrbital: boolean;
  showDensity: boolean;
  isovalue: number;

  // Normal mode animation
  selectedModeIndex: number | null;

  // Geometry snapshot before optimization
  initialPositions: number[] | null;

  // Trajectory
  trajectory: number[][]; // positions at each step
  trajectoryIndex: number;
  isPlaying: boolean;

  // Actions
  setMolecules: (molecules: MoleculeListItem[]) => void;
  setActiveMolecule: (mol: MoleculeData | null) => void;
  setSelectedAtom: (index: number | null) => void;
  setCalculationMethod: (method: CalculationMethodType) => void;
  startCalculation: (calcId: string) => void;
  addProgress: (iteration: number, energy: number, grad_norm: number, positions: number[]) => void;
  completeCalculation: (
    converged: boolean,
    iterations: number,
    energy: number,
    components: EnergyComponents | null,
    positions: number[],
    dftProperties?: DFTProperties | null,
  ) => void;
  failCalculation: (error: string) => void;
  setTrajectoryIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  resetCalculation: () => void;
  updateAtomPositions: (positions: number[]) => void;

  // DFT actions
  setDFTSettings: (settings: Partial<DFTSettings>) => void;
  setDFTProperties: (props: DFTProperties | null) => void;
  setFrequencies: (freq: FrequencyResult | null) => void;
  setOrbitalData: (data: VolumetricData | null) => void;
  setDensityData: (data: VolumetricData | null) => void;
  setSelectedOrbitalIndex: (index: number | null) => void;
  setShowOrbital: (show: boolean) => void;
  setShowDensity: (show: boolean) => void;
  setIsovalue: (val: number) => void;
  setSelectedModeIndex: (index: number | null) => void;
}

export const useStore = create<AppState>((set) => ({
  molecules: [],
  activeMolecule: null,
  selectedAtomIndex: null,
  calculationId: null,
  calculationStatus: "idle",
  calculationMethod: "dft_energy",
  energyComponents: null,
  initialEnergy: null,
  energyHistory: [],
  converged: null,
  iterations: null,
  error: null,
  initialPositions: null,
  trajectory: [],
  trajectoryIndex: 0,
  isPlaying: false,

  // DFT defaults
  dftSettings: { functional: "b3lyp", basis_set: "6-31g*", charge: 0, spin: 0 },
  dftProperties: null,
  frequencies: null,
  orbitalData: null,
  densityData: null,
  selectedOrbitalIndex: null,
  showOrbital: false,
  showDensity: false,
  isovalue: 0.02,
  selectedModeIndex: null,

  setMolecules: (molecules) => set({ molecules }),
  setActiveMolecule: (mol) =>
    set({
      activeMolecule: mol,
      selectedAtomIndex: null,
      calculationStatus: "idle",
      energyComponents: null,
      initialEnergy: null,
      energyHistory: [],
      initialPositions: null,
      trajectory: [],
      trajectoryIndex: 0,
      error: null,
      dftProperties: null,
      frequencies: null,
      orbitalData: null,
      densityData: null,
      selectedOrbitalIndex: null,
      showOrbital: false,
      showDensity: false,
      selectedModeIndex: null,
    }),
  setSelectedAtom: (index) => set({ selectedAtomIndex: index }),
  setCalculationMethod: (method) => set({ calculationMethod: method }),

  startCalculation: (calcId) =>
    set((state) => ({
      calculationId: calcId,
      calculationStatus: "running",
      energyHistory: [],
      trajectory: [],
      trajectoryIndex: 0,
      error: null,
      converged: null,
      initialEnergy: null,
      dftProperties: null,
      frequencies: null,
      orbitalData: null,
      densityData: null,
      selectedOrbitalIndex: null,
      showOrbital: false,
      showDensity: false,
      selectedModeIndex: null,
      // Snapshot positions before optimization starts
      initialPositions: state.activeMolecule
        ? state.activeMolecule.atoms.flatMap((a) => [...a.position])
        : null,
    })),

  addProgress: (iteration, energy, grad_norm, positions) =>
    set((state) => ({
      energyHistory: [...state.energyHistory, { iteration, energy, grad_norm }],
      trajectory: [...state.trajectory, positions],
      trajectoryIndex: state.trajectory.length, // point to latest
      // Capture initial energy from first progress message
      initialEnergy: state.initialEnergy ?? energy,
    })),

  completeCalculation: (converged, iterations, energy, components, positions, dftProperties) =>
    set((state) => ({
      calculationStatus: "completed",
      converged,
      iterations,
      energyComponents: components,
      dftProperties: dftProperties ?? state.dftProperties,
      // Update active molecule positions
      activeMolecule: state.activeMolecule
        ? {
            ...state.activeMolecule,
            atoms: state.activeMolecule.atoms.map((a, i) => ({
              ...a,
              position: [
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2],
              ] as [number, number, number],
            })),
          }
        : null,
    })),

  failCalculation: (error) =>
    set({ calculationStatus: "failed", error }),

  setTrajectoryIndex: (index) => set({ trajectoryIndex: index }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  resetCalculation: () =>
    set({
      calculationId: null,
      calculationStatus: "idle",
      energyComponents: null,
      initialEnergy: null,
      energyHistory: [],
      initialPositions: null,
      trajectory: [],
      trajectoryIndex: 0,
      error: null,
      converged: null,
      dftProperties: null,
      frequencies: null,
      orbitalData: null,
      densityData: null,
      selectedOrbitalIndex: null,
      showOrbital: false,
      showDensity: false,
      selectedModeIndex: null,
    }),

  updateAtomPositions: (positions) =>
    set((state) => ({
      activeMolecule: state.activeMolecule
        ? {
            ...state.activeMolecule,
            atoms: state.activeMolecule.atoms.map((a, i) => ({
              ...a,
              position: [
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2],
              ] as [number, number, number],
            })),
          }
        : null,
    })),

  // DFT actions
  setDFTSettings: (settings) =>
    set((state) => ({ dftSettings: { ...state.dftSettings, ...settings } })),
  setDFTProperties: (props) => set({ dftProperties: props }),
  setFrequencies: (freq) => set({ frequencies: freq }),
  setOrbitalData: (data) => set({ orbitalData: data }),
  setDensityData: (data) => set({ densityData: data }),
  setSelectedOrbitalIndex: (index) => set({ selectedOrbitalIndex: index }),
  setShowOrbital: (show) => set({ showOrbital: show }),
  setShowDensity: (show) => set({ showDensity: show }),
  setIsovalue: (val) => set({ isovalue: val }),
  setSelectedModeIndex: (index) => set({ selectedModeIndex: index }),
}));
