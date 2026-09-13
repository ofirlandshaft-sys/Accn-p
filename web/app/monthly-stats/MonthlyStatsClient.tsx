"use client";

import { useEffect, useState } from "react";
import HomeButton from "../components/HomeButton";
import SchedulePicker from "../components/SchedulePicker";
import ShiftMatrix from "../components/ShiftMatrix";
import type { MatrixData } from "@/lib/matrix-types";
import type { ScheduleFile } from "@/lib/schedule-files";

type MatrixState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MatrixData };

export default function MonthlyStatsClient() {
  const [selected, setSelected] = useState<ScheduleFile | null>(null);
  const [matrixState, setMatrixState] = useState<MatrixState>({ status: "idle" });

  function handleSelect(file: ScheduleFile) {
    setSelected(file);
    setMatrixState({ status: "loading" });
  }

  useEffect(() => {
    if (!selected) return; // idle state was already set (initial, or never selected)
    let cancelled = false;

    fetch(`/api/schedule-matrix?fileId=${encodeURIComponent(selected.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `שגיאת שרת (${res.status})`);
        if (!cancelled) setMatrixState({ status: "ready", data: data as MatrixData });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMatrixState({
            status: "error",
            message: err instanceof Error ? err.message : "שגיאה לא ידועה",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div style={{ direction: "rtl" }}>
      <HomeButton />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 20px 0" }}>
        <SchedulePicker selectedId={selected?.id ?? null} onSelect={handleSelect} />
      </div>

      {matrixState.status === "idle" && (
        <p
          style={{
            maxWidth: 1180,
            margin: "18px auto 0",
            padding: "0 20px",
            fontSize: 14,
            color: "var(--text-muted)",
          }}
        >
          בחרו סידור חודשי מהרשימה למעלה כדי לראות את המטריצה.
        </p>
      )}

      {matrixState.status === "loading" && (
        <p
          style={{
            maxWidth: 1180,
            margin: "18px auto 0",
            padding: "0 20px",
            fontSize: 14,
            color: "var(--text-muted)",
          }}
        >
          טוען וקורא נתונים מתוך הגיליון — {selected?.name}…
        </p>
      )}

      {matrixState.status === "error" && (
        <p
          style={{
            maxWidth: 1180,
            margin: "18px auto 0",
            padding: "0 20px",
            fontSize: 14,
            color: "#c0554a",
          }}
        >
          שגיאה בקריאת הסידור: {matrixState.message}
        </p>
      )}

      {matrixState.status === "ready" && (
        <ShiftMatrix data={matrixState.data} month={selected?.month ?? new Date().getMonth() + 1} />
      )}
    </div>
  );
}
