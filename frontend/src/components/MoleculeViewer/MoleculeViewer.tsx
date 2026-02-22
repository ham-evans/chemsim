"use client";

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoleculeScene } from "./MoleculeScene";
import { useStore } from "@/store/store";

export default function MoleculeViewer(props: { emptyState?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MoleculeScene | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const { resolvedTheme } = useTheme();

  const activeMolecule = useStore((s) => s.activeMolecule);
  const selectedAtomIndex = useStore((s) => s.selectedAtomIndex);
  const setSelectedAtom = useStore((s) => s.setSelectedAtom);
  const trajectory = useStore((s) => s.trajectory);
  const trajectoryIndex = useStore((s) => s.trajectoryIndex);

  // Orbital/Density visualization
  const orbitalData = useStore((s) => s.orbitalData);
  const densityData = useStore((s) => s.densityData);
  const showOrbital = useStore((s) => s.showOrbital);
  const showDensity = useStore((s) => s.showDensity);
  const isovalue = useStore((s) => s.isovalue);

  // Normal mode animation
  const frequencies = useStore((s) => s.frequencies);
  const selectedModeIndex = useStore((s) => s.selectedModeIndex);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new MoleculeScene(containerRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Set click handler
  useEffect(() => {
    sceneRef.current?.setOnAtomClick(setSelectedAtom);
  }, [setSelectedAtom]);

  // Update molecule
  useEffect(() => {
    if (!sceneRef.current || !activeMolecule) return;
    sceneRef.current.setMolecule(activeMolecule.atoms, activeMolecule.bonds);
  }, [activeMolecule]);

  // Highlight selected atom
  useEffect(() => {
    sceneRef.current?.highlightAtom(selectedAtomIndex);
  }, [selectedAtomIndex]);

  // Update positions from trajectory during optimization
  useEffect(() => {
    if (
      !sceneRef.current ||
      trajectory.length === 0 ||
      trajectoryIndex >= trajectory.length
    )
      return;
    const positions = trajectory[trajectoryIndex];
    if (positions && positions.length > 0) {
      sceneRef.current.updatePositions(positions);
    }
  }, [trajectory, trajectoryIndex]);

  // Toggle labels
  useEffect(() => {
    sceneRef.current?.setShowLabels(showLabels);
  }, [showLabels]);

  // Orbital visualization
  useEffect(() => {
    if (!sceneRef.current) return;
    if (showOrbital && orbitalData) {
      try {
        sceneRef.current.setOrbitalData(orbitalData, isovalue);
      } catch (e) {
        console.error("Failed to render orbital:", e);
        sceneRef.current.clearOrbitalMeshes();
      }
    } else {
      sceneRef.current.clearOrbitalMeshes();
    }
  }, [orbitalData, showOrbital, isovalue]);

  // Density visualization
  useEffect(() => {
    if (!sceneRef.current) return;
    if (showDensity && densityData) {
      try {
        sceneRef.current.setDensityData(densityData, isovalue);
      } catch (e) {
        console.error("Failed to render density:", e);
        sceneRef.current.clearDensityMesh();
      }
    } else {
      sceneRef.current.clearDensityMesh();
    }
  }, [densityData, showDensity, isovalue]);

  // Normal mode animation
  useEffect(() => {
    if (!sceneRef.current || !activeMolecule) return;

    if (selectedModeIndex !== null && frequencies && frequencies.normal_modes[selectedModeIndex]) {
      const basePositions = activeMolecule.atoms.flatMap((a) => [...a.position]);
      const displacement = frequencies.normal_modes[selectedModeIndex];
      sceneRef.current.animateNormalMode(basePositions, displacement);
    } else {
      sceneRef.current.stopNormalMode();
    }
  }, [selectedModeIndex, frequencies, activeMolecule]);

  // Update theme
  useEffect(() => {
    sceneRef.current?.setTheme(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] relative">
      {!activeMolecule && props.emptyState}
      {!activeMolecule && !props.emptyState && (
        <div className="absolute inset-0 flex items-center justify-center text-faint pointer-events-none">
          <p className="text-lg">Upload a molecule file to visualize</p>
        </div>
      )}
      {activeMolecule && (
        <label className="absolute top-3 right-3 flex items-center gap-2 bg-surface/80 rounded px-2.5 py-1.5 text-xs text-body cursor-pointer select-none z-10">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="accent-blue-500"
          />
          Show labels
        </label>
      )}
    </div>
  );
}
