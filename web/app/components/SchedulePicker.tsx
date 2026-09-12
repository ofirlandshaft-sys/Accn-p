"use client";

import { useEffect, useState } from "react";
import styles from "./SchedulePicker.module.css";
import { formatHebrewMonthYear } from "@/lib/hebrew-months";
import type { ScheduleFile } from "@/lib/schedule-files";

interface SchedulePickerProps {
  selectedId?: string | null;
  onSelect: (file: ScheduleFile) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; files: ScheduleFile[] };

export default function SchedulePicker({ selectedId, onSelect }: SchedulePickerProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Bump this to re-run the fetch below (mount, and the "refresh" button).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // no-store: this list must reflect Drive's current state every time the
    // app opens — the files sometimes get moved between the two folders.
    fetch("/api/schedule-files", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `שגיאת שרת (${res.status})`);
        if (!cancelled) setState({ status: "ready", files: data.files as ScheduleFile[] });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "שגיאה לא ידועה",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return (
    <div className={styles.wrap}>
      <div className={styles.headRow}>
        <span className={styles.label}>בחרו סידור חודשי (מרשימה חיה מתוך Drive):</span>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            setState({ status: "loading" });
            setReloadToken((t) => t + 1);
          }}
          disabled={state.status === "loading"}
        >
          רענון
        </button>
      </div>

      {state.status === "loading" && (
        <p className={styles.state}>טוען רשימת סידורים מתוך Drive…</p>
      )}

      {state.status === "error" && (
        <p className={`${styles.state} ${styles.error}`}>
          שגיאה בטעינת רשימת הסידורים: {state.message}
        </p>
      )}

      {state.status === "ready" && state.files.length === 0 && (
        <p className={styles.state}>לא נמצאו קבצי סידור בשתי התיקיות.</p>
      )}

      {state.status === "ready" && state.files.length > 0 && (
        <select
          className={styles.select}
          value={selectedId ?? ""}
          onChange={(e) => {
            const file = state.files.find((f) => f.id === e.target.value);
            if (file) onSelect(file);
          }}
        >
          <option value="" disabled>
            בחרו חודש…
          </option>
          {state.files.map((file) => {
            const label =
              file.year != null && file.month != null
                ? formatHebrewMonthYear(file.month, file.year)
                : file.name;
            const sourceLabel = file.source === "current" ? "סידור נוכחי" : "ארכיון";
            return (
              <option key={file.id} value={file.id} title={file.name}>
                {label} — {sourceLabel}
              </option>
            );
          })}
        </select>
      )}
    </div>
  );
}
