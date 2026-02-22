"use client";

import { useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import FileUpload from "@/components/FileUpload/FileUpload";
import CalculationPanel from "@/components/CalculationPanel/CalculationPanel";
import CommandPalette from "@/components/CommandPalette/CommandPalette";
import { useStore } from "@/store/store";
import { getMolecule } from "@/lib/api";

const MoleculeViewer = dynamic(
  () => import("@/components/MoleculeViewer/MoleculeViewer"),
  { ssr: false }
);

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-hover transition-all duration-150"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

function MoleculeList() {
  const molecules = useStore((s) => s.molecules);
  const activeMolecule = useStore((s) => s.activeMolecule);
  const setActiveMolecule = useStore((s) => s.setActiveMolecule);

  const handleSelect = useCallback(
    async (id: string) => {
      try {
        const mol = await getMolecule(id);
        setActiveMolecule(mol);
      } catch {
        // ignore
      }
    },
    [setActiveMolecule]
  );

  if (molecules.length === 0) {
    return (
      <p className="text-faint text-xs px-3 py-3 italic">
        No molecules loaded
      </p>
    );
  }

  return (
    <div className="space-y-0.5 p-1.5">
      {molecules.map((m) => (
        <button
          key={m.id}
          onClick={() => handleSelect(m.id)}
          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
            activeMolecule?.id === m.id
              ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30"
              : "hover:bg-hover text-body"
          }`}
        >
          <span className="block truncate font-medium">{m.name}</span>
          <span className="text-[11px] text-faint">
            {m.num_atoms} atoms, {m.num_bonds} bonds
          </span>
        </button>
      ))}
    </div>
  );
}

function AtomInfo() {
  const activeMolecule = useStore((s) => s.activeMolecule);
  const selectedAtomIndex = useStore((s) => s.selectedAtomIndex);

  if (!activeMolecule || selectedAtomIndex === null) {
    return (
      <p className="text-faint text-xs px-3 py-3 italic">
        Click an atom to inspect
      </p>
    );
  }

  const atom = activeMolecule.atoms[selectedAtomIndex];
  if (!atom) return null;

  return (
    <div className="px-3 py-2.5 text-xs space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-faint">Element</span>
        <span className="font-mono bg-elevated px-1.5 py-0.5 rounded">
          {atom.symbol} (Z={atom.atomic_number})
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-faint">Index</span>
        <span className="font-mono">{atom.index}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-faint">Position</span>
        <span className="font-mono text-[11px]">
          {atom.position[0].toFixed(3)}, {atom.position[1].toFixed(3)},{" "}
          {atom.position[2].toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-3 py-2 text-[11px] font-semibold text-faint uppercase tracking-widest">
      {children}
    </h2>
  );
}

export default function Home() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-base">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 py-2.5 bg-surface/80 border-b border-border-default backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {/* Hexagonal ring */}
            <polygon points="16,4 25.2,9 25.2,19 16,24 6.8,19 6.8,9" stroke="url(#logo-grad)" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
            {/* Inner bonds - alternating double bonds */}
            <line x1="16" y1="4" x2="16" y2="10" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.5" />
            <line x1="25.2" y1="19" x2="20" y2="17" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.5" />
            <line x1="6.8" y1="19" x2="12" y2="17" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.5" />
            {/* Vertex atoms */}
            <circle cx="16" cy="4" r="2.2" fill="#6366f1" />
            <circle cx="25.2" cy="9" r="2.2" fill="#818cf8" />
            <circle cx="25.2" cy="19" r="2.2" fill="#22d3ee" />
            <circle cx="16" cy="24" r="2.2" fill="#06b6d4" />
            <circle cx="6.8" cy="19" r="2.2" fill="#22d3ee" />
            <circle cx="6.8" cy="9" r="2.2" fill="#818cf8" />
            {/* Center glow */}
            <circle cx="16" cy="14" r="3" fill="url(#logo-grad)" opacity="0.15" />
          </svg>
          <h1 className="text-base font-semibold text-heading tracking-wide">
            ChemSim
          </h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Main content: left sidebar | 3D viewer | right sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className="w-56 shrink-0 flex flex-col border-r border-border-default bg-surface/50">
          <FileUpload />

          <div className="px-3 pb-3">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted hover:text-body bg-input hover:bg-hover rounded-lg border border-border-default transition-all duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>AI Generate</span>
              <kbd className="ml-1 px-1.5 py-0.5 bg-elevated rounded text-[10px] font-mono text-faint">
                {"\u2318"}K
              </kbd>
            </button>
          </div>

          <div className="flex-1 border-t border-border-default overflow-y-auto">
            <SectionHeader>Molecules</SectionHeader>
            <MoleculeList />
          </div>

          <div className="shrink-0 border-t border-border-default">
            <SectionHeader>Atom Info</SectionHeader>
            <AtomInfo />
          </div>
        </div>

        {/* Center - 3D viewer */}
        <div className="flex-1 min-w-0 min-h-0 relative">
          <MoleculeViewer
            emptyState={
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-400/10 border border-indigo-500/10 flex items-center justify-center">
                    <svg className="w-9 h-9 opacity-70" viewBox="0 0 32 32" fill="none">
                      <defs>
                        <linearGradient id="empty-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                      <polygon points="16,4 25.2,9 25.2,19 16,24 6.8,19 6.8,9" stroke="url(#empty-logo-grad)" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
                      <line x1="16" y1="4" x2="16" y2="10" stroke="url(#empty-logo-grad)" strokeWidth="1.2" opacity="0.5" />
                      <line x1="25.2" y1="19" x2="20" y2="17" stroke="url(#empty-logo-grad)" strokeWidth="1.2" opacity="0.5" />
                      <line x1="6.8" y1="19" x2="12" y2="17" stroke="url(#empty-logo-grad)" strokeWidth="1.2" opacity="0.5" />
                      <circle cx="16" cy="4" r="2" fill="#6366f1" />
                      <circle cx="25.2" cy="9" r="2" fill="#818cf8" />
                      <circle cx="25.2" cy="19" r="2" fill="#22d3ee" />
                      <circle cx="16" cy="24" r="2" fill="#06b6d4" />
                      <circle cx="6.8" cy="19" r="2" fill="#22d3ee" />
                      <circle cx="6.8" cy="9" r="2" fill="#818cf8" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-medium text-heading">No molecule loaded</p>
                    <p className="text-sm text-muted">Upload a file or generate one with AI</p>
                  </div>
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-2.5 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors duration-150 shadow-lg shadow-blue-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Generate
                  </button>
                  <p className="text-xs text-faint">
                    or press{" "}
                    <kbd className="px-1.5 py-0.5 bg-elevated rounded text-[10px] font-mono border border-border-default">
                      {"\u2318"}K
                    </kbd>
                  </p>
                </div>
              </div>
            }
          />
        </div>

        {/* Right sidebar */}
        <div className="w-76 shrink-0 border-l border-border-default bg-surface/50 flex flex-col min-h-0">
          <CalculationPanel />
        </div>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
