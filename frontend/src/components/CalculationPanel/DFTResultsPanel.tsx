"use client";

import { useStore } from "@/store/store";
import type { DFTProperties } from "@/lib/types";

function EnergyRow({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? "text-body" : "text-faint"}>{label}</span>
      <span className={`font-mono text-[11px] ${color ?? (bold ? "text-heading font-medium" : "text-body")}`}>
        {value}
      </span>
    </div>
  );
}

function OrbitalDiagram({ props }: { props: DFTProperties }) {
  const { mo_energies_ev, homo_index, lumo_index } = props;
  // Show orbitals around HOMO/LUMO (5 below to 5 above)
  const start = Math.max(0, homo_index - 4);
  const end = Math.min(mo_energies_ev.length, lumo_index + 5);
  const orbitals = mo_energies_ev.slice(start, end);
  const minE = Math.min(...orbitals);
  const maxE = Math.max(...orbitals);
  const range = maxE - minE || 1;

  return (
    <div className="mt-2">
      <h4 className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-1">
        Orbital Energies
      </h4>
      <div className="flex items-end gap-0.5 h-24 px-1">
        {orbitals.map((e, idx) => {
          const globalIdx = start + idx;
          const height = ((e - minE) / range) * 100;
          const isHomo = globalIdx === homo_index;
          const isLumo = globalIdx === lumo_index;
          const isOccupied = globalIdx <= homo_index;
          return (
            <div
              key={globalIdx}
              className="flex flex-col items-center flex-1 min-w-0"
              title={`MO ${globalIdx}: ${e.toFixed(3)} eV${isHomo ? " (HOMO)" : ""}${isLumo ? " (LUMO)" : ""}`}
            >
              <div
                className={`w-full rounded-t-sm ${
                  isHomo ? "bg-green-500" : isLumo ? "bg-red-500" :
                  isOccupied ? "bg-blue-500/70" : "bg-gray-600/50"
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              {(isHomo || isLumo) && (
                <span className="text-[8px] text-muted mt-0.5 leading-none">
                  {isHomo ? "H" : "L"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DFTResultsPanel() {
  const energy = useStore((s) => {
    const calc = s.calculationId;
    return calc ? s.energyComponents?.total : null;
  });
  const dftProperties = useStore((s) => s.dftProperties);
  const calculationStatus = useStore((s) => s.calculationStatus);
  const storeEnergy = useStore((s) => {
    // For DFT, energy is stored directly (Hartree)
    const data = s.calculationId;
    return data ? null : null;
  });

  if (calculationStatus !== "completed" || !dftProperties) return null;

  const totalEnergy = useStore.getState().energyHistory.length > 0
    ? useStore.getState().energyHistory[useStore.getState().energyHistory.length - 1].energy
    : null;

  const activeMolecule = useStore.getState().activeMolecule;

  return (
    <div className="bg-card rounded-xl p-3.5 border border-card-border space-y-2">
      <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest">
        DFT Results
      </h3>
      <div className="text-xs space-y-1">
        <EnergyRow
          label="HOMO-LUMO Gap"
          value={`${dftProperties.homo_lumo_gap_ev.toFixed(4)} eV`}
          bold
        />
        <EnergyRow
          label="HOMO"
          value={`${dftProperties.mo_energies_ev[dftProperties.homo_index].toFixed(4)} eV`}
          color="text-green-400"
        />
        <EnergyRow
          label="LUMO"
          value={`${dftProperties.mo_energies_ev[dftProperties.lumo_index].toFixed(4)} eV`}
          color="text-red-400"
        />

        <OrbitalDiagram props={dftProperties} />

        {/* Dipole moment */}
        <div className="pt-2 mt-2 border-t border-card-border">
          <EnergyRow
            label="Dipole (Debye)"
            value={dftProperties.dipole_magnitude.toFixed(4)}
            bold
          />
          <EnergyRow
            label="Components"
            value={`(${dftProperties.dipole.map(d => d.toFixed(3)).join(", ")})`}
          />
        </div>

        {/* Mulliken charges */}
        {activeMolecule && dftProperties.mulliken_charges.length > 0 && (
          <div className="pt-2 mt-2 border-t border-card-border">
            <h4 className="text-[10px] font-semibold text-faint uppercase tracking-widest mb-1">
              Mulliken Charges
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {dftProperties.mulliken_charges.map((q, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-faint">
                    {activeMolecule.atoms[i]?.symbol ?? i}{i}
                  </span>
                  <span className={`font-mono text-[11px] ${q >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    {q >= 0 ? "+" : ""}{q.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
