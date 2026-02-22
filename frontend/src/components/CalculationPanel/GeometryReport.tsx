"use client";

import { useMemo } from "react";
import { useStore } from "@/store/store";
import type { Atom, Bond } from "@/lib/types";

function dist(a: Atom, b: Atom): number {
  const dx = a.position[0] - b.position[0];
  const dy = a.position[1] - b.position[1];
  const dz = a.position[2] - b.position[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distFromFlat(positions: number[], i: number, j: number): number {
  const dx = positions[i * 3] - positions[j * 3];
  const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
  const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angleDeg(a: Atom, center: Atom, b: Atom): number {
  const v1 = [
    a.position[0] - center.position[0],
    a.position[1] - center.position[1],
    a.position[2] - center.position[2],
  ];
  const v2 = [
    b.position[0] - center.position[0],
    b.position[1] - center.position[1],
    b.position[2] - center.position[2],
  ];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const m1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const m2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);
  if (m1 < 1e-10 || m2 < 1e-10) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180) / Math.PI;
}

function angleFromFlat(pos: number[], i: number, j: number, k: number): number {
  const v1 = [pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]];
  const v2 = [pos[k * 3] - pos[j * 3], pos[k * 3 + 1] - pos[j * 3 + 1], pos[k * 3 + 2] - pos[j * 3 + 2]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const m1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2);
  const m2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2);
  if (m1 < 1e-10 || m2 < 1e-10) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180) / Math.PI;
}

interface AngleEntry {
  i: number;
  j: number; // center
  k: number;
  label: string;
}

function buildAngles(atoms: Atom[], bonds: Bond[]): AngleEntry[] {
  const adj: number[][] = atoms.map(() => []);
  for (const b of bonds) {
    adj[b.atom_i].push(b.atom_j);
    adj[b.atom_j].push(b.atom_i);
  }
  const angles: AngleEntry[] = [];
  for (let j = 0; j < atoms.length; j++) {
    const nbrs = adj[j];
    for (let a = 0; a < nbrs.length; a++) {
      for (let b = a + 1; b < nbrs.length; b++) {
        const i = nbrs[a], k = nbrs[b];
        angles.push({
          i, j, k,
          label: `${atoms[i].symbol}${i}-${atoms[j].symbol}${j}-${atoms[k].symbol}${k}`,
        });
      }
    }
  }
  return angles;
}

export default function GeometryReport() {
  const activeMolecule = useStore((s) => s.activeMolecule);
  const initialPositions = useStore((s) => s.initialPositions);
  const calculationStatus = useStore((s) => s.calculationStatus);

  const hasOptimized = calculationStatus === "completed" && initialPositions !== null;

  const angles = useMemo(() => {
    if (!activeMolecule) return [];
    return buildAngles(activeMolecule.atoms, activeMolecule.bonds);
  }, [activeMolecule]);

  if (!activeMolecule) return null;
  const { atoms, bonds } = activeMolecule;

  return (
    <div className="space-y-3">
      {/* Bond lengths */}
      <div className="bg-card rounded-xl p-3.5 border border-card-border">
        <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-2">
          Bond Lengths (A)
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-faint">
              <th className="text-left font-medium py-1 pb-1.5">Bond</th>
              <th className="text-right font-medium py-1 pb-1.5">Length</th>
              {hasOptimized && (
                <>
                  <th className="text-right font-medium py-1 pb-1.5">Initial</th>
                  <th className="text-right font-medium py-1 pb-1.5">Change</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {bonds.map((b, idx) => {
              const ai = atoms[b.atom_i];
              const aj = atoms[b.atom_j];
              const current = dist(ai, aj);
              const initial = hasOptimized
                ? distFromFlat(initialPositions, b.atom_i, b.atom_j)
                : null;
              const delta = initial !== null ? current - initial : null;

              return (
                <tr key={idx} className="border-t border-card-border">
                  <td className="py-1 text-body">
                    {ai.symbol}{b.atom_i}-{aj.symbol}{b.atom_j}
                  </td>
                  <td className="py-1 text-right font-mono text-body">
                    {current.toFixed(4)}
                  </td>
                  {hasOptimized && (
                    <>
                      <td className="py-1 text-right font-mono text-faint">
                        {initial!.toFixed(4)}
                      </td>
                      <td className={`py-1 text-right font-mono ${
                        Math.abs(delta!) < 0.001
                          ? "text-gray-600"
                          : delta! > 0
                            ? "text-red-400"
                            : "text-green-400"
                      }`}>
                        {delta! > 0 ? "+" : ""}{delta!.toFixed(4)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Angles */}
      {angles.length > 0 && (
        <div className="bg-card rounded-xl p-3.5 border border-card-border">
          <h3 className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-2">
            Bond Angles (deg)
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-faint">
                <th className="text-left font-medium py-1 pb-1.5">Angle</th>
                <th className="text-right font-medium py-1 pb-1.5">Value</th>
                {hasOptimized && (
                  <>
                    <th className="text-right font-medium py-1 pb-1.5">Initial</th>
                    <th className="text-right font-medium py-1 pb-1.5">Change</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {angles.map((ang, idx) => {
                const current = angleDeg(atoms[ang.i], atoms[ang.j], atoms[ang.k]);
                const initial = hasOptimized
                  ? angleFromFlat(initialPositions, ang.i, ang.j, ang.k)
                  : null;
                const delta = initial !== null ? current - initial : null;

                return (
                  <tr key={idx} className="border-t border-card-border">
                    <td className="py-1 text-body">{ang.label}</td>
                    <td className="py-1 text-right font-mono text-body">
                      {current.toFixed(2)}
                    </td>
                    {hasOptimized && (
                      <>
                        <td className="py-1 text-right font-mono text-faint">
                          {initial!.toFixed(2)}
                        </td>
                        <td className={`py-1 text-right font-mono ${
                          Math.abs(delta!) < 0.1
                            ? "text-gray-600"
                            : delta! > 0
                              ? "text-red-400"
                              : "text-green-400"
                        }`}>
                          {delta! > 0 ? "+" : ""}{delta!.toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
