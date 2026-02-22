"use client";

import { useRef, useEffect } from "react";
import { useStore } from "@/store/store";

export default function TrajectorySlider() {
  const trajectory = useStore((s) => s.trajectory);
  const trajectoryIndex = useStore((s) => s.trajectoryIndex);
  const setTrajectoryIndex = useStore((s) => s.setTrajectoryIndex);
  const isPlaying = useStore((s) => s.isPlaying);
  const setIsPlaying = useStore((s) => s.setIsPlaying);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        const state = useStore.getState();
        const next = state.trajectoryIndex + 1;
        if (next >= state.trajectory.length) {
          setIsPlaying(false);
        } else {
          setTrajectoryIndex(next);
        }
      }, 50);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, setIsPlaying, setTrajectoryIndex]);

  if (trajectory.length < 2) return null;

  return (
    <div className="bg-card rounded-xl p-3.5 border border-card-border">
      <p className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-2">
        Trajectory
      </p>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => {
            if (isPlaying) {
              setIsPlaying(false);
            } else {
              if (trajectoryIndex >= trajectory.length - 1) {
                setTrajectoryIndex(0);
              }
              setIsPlaying(true);
            }
          }}
          className="text-body hover:text-heading text-xs px-3 py-1.5 bg-input hover:bg-hover rounded-lg border border-border-default transition-all duration-150 font-medium"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={trajectory.length - 1}
          value={trajectoryIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setTrajectoryIndex(parseInt(e.target.value));
          }}
          className="flex-1"
        />
        <span className="text-[11px] text-faint font-mono w-14 text-right">
          {trajectoryIndex + 1}/{trajectory.length}
        </span>
      </div>
    </div>
  );
}
