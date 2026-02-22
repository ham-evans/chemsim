"use client";

import { useCallback, useState, useRef } from "react";
import { uploadMolecule } from "@/lib/api";
import { useStore } from "@/store/store";

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setActiveMolecule = useStore((s) => s.setActiveMolecule);
  const setMolecules = useStore((s) => s.setMolecules);
  const molecules = useStore((s) => s.molecules);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const mol = await uploadMolecule(file);
        setActiveMolecule(mol);
        setMolecules([
          ...molecules,
          {
            id: mol.id,
            name: mol.name,
            num_atoms: mol.num_atoms,
            num_bonds: mol.num_bonds,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [molecules, setActiveMolecule, setMolecules]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div className="p-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-400 bg-blue-400/10 scale-[1.02]"
            : "border-border-default hover:border-muted hover:bg-card"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xyz,.sdf,.mol"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 text-sm">Uploading...</p>
          </div>
        ) : (
          <div>
            <svg
              className="w-5 h-5 mx-auto mb-1.5 text-faint"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-muted text-xs">
              Drop <span className="text-body">.xyz</span> or{" "}
              <span className="text-body">.sdf</span> file
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-2 px-1">{error}</p>
      )}
    </div>
  );
}
