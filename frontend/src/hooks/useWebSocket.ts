"use client";

import { useEffect, useRef, useCallback } from "react";
import { createCalculationWS } from "@/lib/api";
import { useStore } from "@/store/store";
import type { WSMessage } from "@/lib/types";

export function useCalculationWS() {
  const wsRef = useRef<WebSocket | null>(null);
  const throttleRef = useRef<number>(0);

  const addProgress = useStore((s) => s.addProgress);
  const completeCalculation = useStore((s) => s.completeCalculation);
  const failCalculation = useStore((s) => s.failCalculation);

  const connect = useCallback(
    (calcId: string) => {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = createCalculationWS(calcId);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg: WSMessage = JSON.parse(event.data);

        if (msg.type === "progress") {
          // Throttle to ~30fps
          const now = Date.now();
          if (now - throttleRef.current < 33) return;
          throttleRef.current = now;

          addProgress(msg.iteration, msg.energy, msg.grad_norm, msg.positions);
        } else if (msg.type === "completed") {
          completeCalculation(
            msg.converged,
            msg.iterations,
            msg.final_energy,
            msg.energy_components ?? null,
            msg.positions,
            msg.dft_properties,
          );
        } else if (msg.type === "error") {
          failCalculation(msg.error);
        }
      };

      ws.onerror = () => {
        failCalculation("WebSocket connection error");
      };
    },
    [addProgress, completeCalculation, failCalculation]
  );

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return { connect, disconnect };
}
