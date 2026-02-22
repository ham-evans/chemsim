"use client";

import { useStore } from "@/store/store";

export default function FrequencyPanel() {
  const frequencies = useStore((s) => s.frequencies);
  const selectedModeIndex = useStore((s) => s.selectedModeIndex);
  const setSelectedModeIndex = useStore((s) => s.setSelectedModeIndex);

  if (!frequencies) return null;

  // Skip first 6 modes (translations + rotations)
  const vibrational = frequencies.frequencies_cm1.slice(6);
  const modes = frequencies.normal_modes.slice(6);

  return (
    <div className="bg-card rounded-xl p-3.5 border border-card-border space-y-2">
      <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest">
        Vibrational Frequencies
      </h3>
      {frequencies.num_imaginary > 0 && (
        <div className="text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
          {frequencies.num_imaginary} imaginary frequenc{frequencies.num_imaginary === 1 ? "y" : "ies"} detected
        </div>
      )}
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-faint text-[10px]">
              <th className="text-left py-0.5">#</th>
              <th className="text-right py-0.5">cm<sup>-1</sup></th>
              <th className="text-right py-0.5">Animate</th>
            </tr>
          </thead>
          <tbody>
            {vibrational.map((freq, i) => {
              const globalIdx = i + 6;
              const isImaginary = freq < 0;
              const isSelected = selectedModeIndex === globalIdx;
              return (
                <tr
                  key={i}
                  className={`border-t border-border-subtle cursor-pointer hover:bg-hover ${
                    isSelected ? "bg-blue-500/10" : ""
                  }`}
                  onClick={() => setSelectedModeIndex(isSelected ? null : globalIdx)}
                >
                  <td className="py-0.5 text-faint">{i + 1}</td>
                  <td className={`py-0.5 text-right font-mono ${isImaginary ? "text-red-400" : "text-body"}`}>
                    {isImaginary ? `${freq.toFixed(1)}i` : freq.toFixed(1)}
                  </td>
                  <td className="py-0.5 text-right">
                    {isSelected && (
                      <span className="text-blue-400 text-[10px]">playing</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
