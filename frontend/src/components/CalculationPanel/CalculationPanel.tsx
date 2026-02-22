"use client";

import { useCallback } from "react";
import { startCalculation, getCalculation } from "@/lib/api";
import { useStore } from "@/store/store";
import { useCalculationWS } from "@/hooks/useWebSocket";
import EnergyChart from "./EnergyChart";
import TrajectorySlider from "./TrajectorySlider";
import GeometryReport from "./GeometryReport";
import DFTSettingsPanel from "./DFTSettingsPanel";
import DFTResultsPanel from "./DFTResultsPanel";
import OrbitalSelector from "./OrbitalSelector";
import FrequencyPanel from "./FrequencyPanel";
import type { CalculationMethodType } from "@/lib/types";

function EnergyRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? "text-body" : "text-faint"}>{label}</span>
      <span
        className={`font-mono text-[11px] ${
          color ?? (bold ? "text-heading font-medium" : "text-body")
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function CalculationPanel() {
  const activeMolecule = useStore((s) => s.activeMolecule);
  const calculationStatus = useStore((s) => s.calculationStatus);
  const calculationMethod = useStore((s) => s.calculationMethod);
  const setCalculationMethod = useStore((s) => s.setCalculationMethod);
  const startCalc = useStore((s) => s.startCalculation);
  const energyComponents = useStore((s) => s.energyComponents);
  const converged = useStore((s) => s.converged);
  const iterations = useStore((s) => s.iterations);
  const error = useStore((s) => s.error);
  const energyHistory = useStore((s) => s.energyHistory);
  const initialEnergy = useStore((s) => s.initialEnergy);
  const dftSettings = useStore((s) => s.dftSettings);

  const { connect } = useCalculationWS();

  const handleRun = useCallback(async () => {
    if (!activeMolecule) return;

    try {
      const result = await startCalculation(
        activeMolecule.id,
        calculationMethod,
        { dft_settings: dftSettings },
      );

      startCalc(result.id);
      if (calculationMethod === "dft_optimize") {
        connect(result.id);
      } else {
        pollForResult(result.id);
      }
    } catch (e) {
      useStore.getState().failCalculation(
        e instanceof Error ? e.message : "Calculation failed"
      );
    }
  }, [activeMolecule, calculationMethod, startCalc, connect, dftSettings]);

  if (!activeMolecule) {
    return (
      <div className="p-5 text-faint text-sm italic">
        Load a molecule to run calculations
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 p-4 border-b border-border-default space-y-3">
        <h2 className="text-[11px] font-semibold text-faint uppercase tracking-widest">
          Calculation
        </h2>
        <div className="flex gap-2 items-center">
          <select
            value={calculationMethod}
            onChange={(e) =>
              setCalculationMethod(e.target.value as CalculationMethodType)
            }
            className="bg-input text-body rounded-lg px-3 py-2 text-sm flex-1 border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
            disabled={calculationStatus === "running"}
          >
            <option value="dft_energy">Energy</option>
            <option value="dft_optimize">Optimize</option>
            <option value="dft_frequency">Frequency</option>
          </select>
          <button
            onClick={handleRun}
            disabled={calculationStatus === "running"}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 disabled:shadow-none"
          >
            {calculationStatus === "running" ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running
              </span>
            ) : (
              "Run"
            )}
          </button>
        </div>

        <DFTSettingsPanel />

        {error && (
          <div className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20">
            {error}
          </div>
        )}
      </div>

      {/* Scrollable results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Energy component summary */}
        {energyComponents && (
          <div className="bg-card rounded-xl p-3.5 border border-card-border space-y-1.5">
            <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-2">
              Energy (kcal/mol)
            </h3>
            <div className="text-xs space-y-1">
              {initialEnergy !== null && (
                <EnergyRow
                  label="Initial"
                  value={initialEnergy.toFixed(6)}
                />
              )}
              <EnergyRow
                label={initialEnergy !== null ? "Final" : "Total"}
                value={energyComponents.total.toFixed(6)}
                bold
              />
              {initialEnergy !== null && (
                <EnergyRow
                  label="Change"
                  value={
                    (energyComponents.total - initialEnergy >= 0 ? "" : "") +
                    (energyComponents.total - initialEnergy).toFixed(6)
                  }
                  color="text-green-400"
                />
              )}
              <div className="mt-2 pt-2 border-t border-card-border space-y-1">
                <EnergyRow
                  label="Stretch"
                  value={energyComponents.bond_stretch.toFixed(6)}
                />
                <EnergyRow
                  label="Bend"
                  value={energyComponents.angle_bend.toFixed(6)}
                />
                <EnergyRow
                  label="Torsion"
                  value={energyComponents.torsion.toFixed(6)}
                />
                <EnergyRow
                  label="VdW"
                  value={energyComponents.vdw.toFixed(6)}
                />
              </div>
              {converged !== null && (
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-card-border">
                  <span className="text-muted">Status</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      converged
                        ? "bg-green-400/10 text-green-400"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    {converged ? "Converged" : "Not converged"}
                    {iterations !== null && ` (${iterations} iter)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DFT Results */}
        <DFTResultsPanel />

        {/* Orbital/Density visualization controls */}
        <OrbitalSelector />

        {/* Frequency panel */}
        <FrequencyPanel />

        {/* Energy chart */}
        {energyHistory.length > 1 && <EnergyChart />}

        {/* Trajectory playback */}
        {calculationStatus === "completed" && <TrajectorySlider />}

        {/* Geometry report */}
        <GeometryReport />
      </div>
    </div>
  );
}

/** Poll for async DFT calculation results. */
async function pollForResult(calcId: string) {
  const maxAttempts = 600; // 10 minutes at 1s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const result = await getCalculation(calcId);
      if (result.status === "completed") {
        const store = useStore.getState();
        const positions = result.optimized_positions
          ?? store.activeMolecule?.atoms.flatMap((a) => a.position)
          ?? [];
        store.completeCalculation(
          result.converged ?? true,
          result.iterations ?? 0,
          result.energy ?? 0,
          result.energy_components ?? null,
          positions,
          result.dft_properties,
        );
        if (result.frequencies) {
          useStore.getState().setFrequencies(result.frequencies);
        }
        return;
      } else if (result.status === "failed") {
        useStore.getState().failCalculation(result.error ?? "Calculation failed");
        return;
      }
    } catch {
      // retry
    }
  }
  useStore.getState().failCalculation("Calculation timed out");
}
