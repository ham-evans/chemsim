"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useStore } from "@/store/store";

function useCSSVar(name: string, fallback: string): string {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const update = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      setValue(v || fallback);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [name, fallback]);
  return value;
}

export default function EnergyChart() {
  const energyHistory = useStore((s) => s.energyHistory);
  const axisColor = useCSSVar("--color-axis", "#2a2d3a");
  const tickColor = useCSSVar("--color-faint", "#6b7280");
  const tooltipBg = useCSSVar("--color-tooltip-bg", "#1e2030");
  const tooltipBorder = useCSSVar("--color-tooltip-border", "rgba(255,255,255,0.08)");
  const accentColor = useCSSVar("--color-accent", "#60a5fa");

  if (energyHistory.length < 2) return null;

  return (
    <div className="bg-card rounded-xl p-3.5 border border-card-border">
      <p className="text-[11px] font-semibold text-faint uppercase tracking-widest mb-2">
        Energy vs Iteration
      </p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={energyHistory}>
            <XAxis
              dataKey="iteration"
              tick={{ fontSize: 10, fill: tickColor }}
              tickLine={false}
              axisLine={{ stroke: axisColor }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: tickColor }}
              tickLine={false}
              axisLine={{ stroke: axisColor }}
              width={50}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "8px",
                fontSize: "11px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
              labelStyle={{ color: tickColor }}
              formatter={(value) => [
                (value as number).toFixed(4) + " kcal/mol",
                "Energy",
              ]}
            />
            <Line
              type="monotone"
              dataKey="energy"
              stroke={accentColor}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
