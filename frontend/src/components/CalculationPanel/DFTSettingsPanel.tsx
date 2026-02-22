"use client";

import { useStore } from "@/store/store";

const FUNCTIONALS = [
  "b3lyp", "pbe", "pbe0", "m06-2x", "wb97x-d", "tpss", "hf",
];

const BASIS_SETS = [
  "sto-3g", "6-31g", "6-31g*", "6-31+g*", "6-311g**",
  "cc-pvdz", "cc-pvtz", "def2-svp", "def2-tzvp",
];

export default function DFTSettingsPanel() {
  const dftSettings = useStore((s) => s.dftSettings);
  const setDFTSettings = useStore((s) => s.setDFTSettings);
  const calculationStatus = useStore((s) => s.calculationStatus);
  const disabled = calculationStatus === "running";

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold text-faint uppercase tracking-widest">
        DFT Settings
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-faint block mb-0.5">Functional</label>
          <select
            value={dftSettings.functional}
            onChange={(e) => setDFTSettings({ functional: e.target.value })}
            disabled={disabled}
            className="w-full bg-input text-body rounded px-2 py-1.5 text-xs border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            {FUNCTIONALS.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-faint block mb-0.5">Basis Set</label>
          <select
            value={dftSettings.basis_set}
            onChange={(e) => setDFTSettings({ basis_set: e.target.value })}
            disabled={disabled}
            className="w-full bg-input text-body rounded px-2 py-1.5 text-xs border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          >
            {BASIS_SETS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-faint block mb-0.5">Charge</label>
          <input
            type="number"
            value={dftSettings.charge}
            onChange={(e) => setDFTSettings({ charge: parseInt(e.target.value) || 0 })}
            disabled={disabled}
            className="w-full bg-input text-body rounded px-2 py-1.5 text-xs border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-faint block mb-0.5">Spin (2S)</label>
          <input
            type="number"
            min={0}
            value={dftSettings.spin}
            onChange={(e) => setDFTSettings({ spin: parseInt(e.target.value) || 0 })}
            disabled={disabled}
            className="w-full bg-input text-body rounded px-2 py-1.5 text-xs border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>
    </div>
  );
}
