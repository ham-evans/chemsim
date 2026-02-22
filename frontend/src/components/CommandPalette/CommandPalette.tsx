"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { generateMolecule } from "@/lib/api";
import { useStore } from "@/store/store";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setActiveMolecule = useStore((s) => s.setActiveMolecule);
  const setMolecules = useStore((s) => s.setMolecules);
  const molecules = useStore((s) => s.molecules);

  useEffect(() => {
    if (open) {
      setQuery("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const description = query.trim();
    if (!description || loading) return;

    setError(null);
    setLoading(true);
    try {
      const mol = await generateMolecule(description);
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
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [query, loading, molecules, setActiveMolecule, setMolecules, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "20vh" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg h-fit animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--color-command-bg)] border border-[var(--color-command-border)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="flex items-center px-5 py-4 gap-3">
            <svg
              className="w-5 h-5 text-blue-400/70 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Describe a molecule... (e.g. caffeine, aspirin)"
              className="flex-1 bg-transparent text-heading placeholder-faint outline-none text-sm"
              disabled={loading}
            />
            {loading && (
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
          </div>

          {error && (
            <div className="mx-5 mb-3 text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/20">
              {error}
            </div>
          )}

          <div className="border-t border-border-default px-5 py-2.5 flex justify-between text-[11px] text-faint">
            <span>
              <kbd className="px-1.5 py-0.5 bg-elevated rounded text-muted font-mono">
                Enter
              </kbd>{" "}
              to generate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-elevated rounded text-muted font-mono">
                Esc
              </kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
