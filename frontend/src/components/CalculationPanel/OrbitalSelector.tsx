"use client";

import { useCallback, useMemo } from "react";
import { useStore } from "@/store/store";
import { getOrbitalData, getDensityData } from "@/lib/api";

export default function OrbitalSelector() {
  const dftProperties = useStore((s) => s.dftProperties);
  const calculationId = useStore((s) => s.calculationId);
  const selectedOrbitalIndex = useStore((s) => s.selectedOrbitalIndex);
  const showOrbital = useStore((s) => s.showOrbital);
  const showDensity = useStore((s) => s.showDensity);
  const isovalue = useStore((s) => s.isovalue);
  const setSelectedOrbitalIndex = useStore((s) => s.setSelectedOrbitalIndex);
  const setShowOrbital = useStore((s) => s.setShowOrbital);
  const setShowDensity = useStore((s) => s.setShowDensity);
  const setIsovalue = useStore((s) => s.setIsovalue);
  const setOrbitalData = useStore((s) => s.setOrbitalData);
  const setDensityData = useStore((s) => s.setDensityData);

  const orbitalOptions = useMemo(() => {
    if (!dftProperties) return [];
    const { homo_index, lumo_index, mo_energies_ev } = dftProperties;
    const start = Math.max(0, homo_index - 4);
    const end = Math.min(mo_energies_ev.length, lumo_index + 5);
    const opts = [];
    for (let i = start; i < end; i++) {
      let label: string;
      if (i === homo_index) label = "HOMO";
      else if (i === lumo_index) label = "LUMO";
      else if (i < homo_index) label = `HOMO-${homo_index - i}`;
      else label = `LUMO+${i - lumo_index}`;
      opts.push({ index: i, label, energy: mo_energies_ev[i] });
    }
    return opts;
  }, [dftProperties]);

  const handleOrbitalChange = useCallback(async (idx: number) => {
    setSelectedOrbitalIndex(idx);
    if (showOrbital && calculationId) {
      try {
        const data = await getOrbitalData(calculationId, idx);
        setOrbitalData(data);
      } catch (e) { console.error("Failed to fetch orbital data:", e); }
    }
  }, [showOrbital, calculationId, setSelectedOrbitalIndex, setOrbitalData]);

  const handleShowOrbital = useCallback(async (checked: boolean) => {
    setShowOrbital(checked);
    const idx = selectedOrbitalIndex ?? dftProperties?.homo_index ?? null;
    if (checked && calculationId && idx !== null) {
      if (selectedOrbitalIndex === null) setSelectedOrbitalIndex(idx);
      try {
        const data = await getOrbitalData(calculationId, idx);
        setOrbitalData(data);
      } catch (e) { console.error("Failed to fetch orbital data:", e); }
    } else if (!checked) {
      setOrbitalData(null);
    }
  }, [calculationId, selectedOrbitalIndex, dftProperties, setShowOrbital, setOrbitalData, setSelectedOrbitalIndex]);

  const handleShowDensity = useCallback(async (checked: boolean) => {
    setShowDensity(checked);
    if (checked && calculationId) {
      try {
        const data = await getDensityData(calculationId);
        setDensityData(data);
      } catch (e) { console.error("Failed to fetch density data:", e); }
    } else if (!checked) {
      setDensityData(null);
    }
  }, [calculationId, setShowDensity, setDensityData]);

  if (!dftProperties || !calculationId) return null;

  const { homo_index } = dftProperties;

  return (
    <div className="bg-card rounded-xl p-3.5 border border-card-border space-y-2">
      <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest">
        Visualization
      </h3>

      {/* Orbital selector */}
      <div>
        <label className="text-[10px] text-faint block mb-0.5">Molecular Orbital</label>
        <select
          value={selectedOrbitalIndex ?? homo_index}
          onChange={(e) => handleOrbitalChange(parseInt(e.target.value))}
          className="w-full bg-input text-body rounded px-2 py-1.5 text-xs border border-border-default focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        >
          {orbitalOptions.map((o) => (
            <option key={o.index} value={o.index}>
              {o.label} ({o.energy.toFixed(2)} eV)
            </option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-body cursor-pointer">
          <input
            type="checkbox"
            checked={showOrbital}
            onChange={(e) => handleShowOrbital(e.target.checked)}
            className="accent-blue-500"
          />
          Show Orbital
        </label>
        <label className="flex items-center gap-1.5 text-xs text-body cursor-pointer">
          <input
            type="checkbox"
            checked={showDensity}
            onChange={(e) => handleShowDensity(e.target.checked)}
            className="accent-green-500"
          />
          Show Density
        </label>
      </div>

      {/* Isovalue slider */}
      <div>
        <label className="text-[10px] text-faint block mb-0.5">
          Isovalue: {isovalue.toFixed(3)}
        </label>
        <input
          type="range"
          min={0.005}
          max={0.1}
          step={0.001}
          value={isovalue}
          onChange={(e) => setIsovalue(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  );
}
