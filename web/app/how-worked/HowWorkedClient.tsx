"use client";

import { useEffect, useState } from "react";
import styles from "./HowWorkedClient.module.css";

interface Block {
  start: string;
  end: string;
  worked: boolean;
}

interface ShiftDay {
  day: number;
  month: number;
  year: number;
  blocks: Block[];
}

interface ScheduleResponse {
  employee: string;
  monthlyFileName: string;
  dailyFileName: string;
  totalWorkDaysThisMonth: number;
  shifts: ShiftDay[];
}

type EmployeesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; names: string[] };

type ScheduleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ScheduleResponse };

const COUNT_OPTIONS = [1, 2, 3, 4, 5];

export default function HowWorkedClient() {
  const [employeesState, setEmployeesState] = useState<EmployeesState>({ status: "loading" });
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [scheduleState, setScheduleState] = useState<ScheduleState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/employees", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `שגיאת שרת (${res.status})`);
        if (!cancelled) setEmployeesState({ status: "ready", names: data.names as string[] });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEmployeesState({
            status: "error",
            message: err instanceof Error ? err.message : "שגיאה לא ידועה",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Wait for both selections — an employee first, then a shift count —
    // before fetching anything (per Ofir: don't fetch on employee-select alone).
    if (!selectedEmployee || !count) return;
    let cancelled = false;

    fetch(`/api/employee-schedule?employee=${encodeURIComponent(selectedEmployee)}&count=${count}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `שגיאת שרת (${res.status})`);
        if (!cancelled) setScheduleState({ status: "ready", data: data as ScheduleResponse });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setScheduleState({
            status: "error",
            message: err instanceof Error ? err.message : "שגיאה לא ידועה",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee, count]);

  function handleSelectEmployee(name: string) {
    setSelectedEmployee(name);
    setScheduleState(count ? { status: "loading" } : { status: "idle" });
  }

  function handleSelectCount(n: number) {
    setCount(n);
    if (selectedEmployee) setScheduleState({ status: "loading" });
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <h1 className={styles.h1}>איך עבד X?</h1>
        <p className={styles.lede}>
          בחרו עובד/ת ומספר משמרות אחרונות לבדוק — הטבלה תראה באילו בלוקי שעתיים העובד/ת היה/תה משובץ/ת,
          לפי הסידור היומי.
        </p>
      </header>

      <div className={styles.controls}>
        <div className={styles.field}>
          <span className={styles.label}>עובד/ת:</span>
          {employeesState.status === "loading" && <p className={styles.state}>טוען רשימת עובדים…</p>}
          {employeesState.status === "error" && (
            <p className={`${styles.state} ${styles.error}`}>שגיאה בטעינת עובדים: {employeesState.message}</p>
          )}
          {employeesState.status === "ready" && (
            <select
              className={styles.select}
              value={selectedEmployee}
              onChange={(e) => handleSelectEmployee(e.target.value)}
            >
              <option value="" disabled>
                בחרו עובד/ת…
              </option>
              {employeesState.names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedEmployee && (
          <div className={styles.field}>
            <span className={styles.label}>כמה משמרות אחרונות להציג:</span>
            <div className={styles.countRow}>
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.countBtn} ${n === count ? styles.countBtnActive : ""}`}
                  onClick={() => handleSelectCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {scheduleState.status === "idle" && !selectedEmployee && (
        <p className={styles.state}>בחרו עובד/ת כדי להתחיל.</p>
      )}
      {scheduleState.status === "idle" && selectedEmployee && !count && (
        <p className={styles.state}>בחרו כמה משמרות אחרונות להציג.</p>
      )}
      {scheduleState.status === "loading" && <p className={styles.state}>טוען נתונים מהסידור היומי…</p>}
      {scheduleState.status === "error" && (
        <p className={`${styles.state} ${styles.error}`}>שגיאה: {scheduleState.message}</p>
      )}

      {scheduleState.status === "ready" && (
        <>
          <p className={styles.meta}>
            {scheduleState.data.employee} עבד/ה {scheduleState.data.totalWorkDaysThisMonth} משמרות החודש
            (מקור: {scheduleState.data.monthlyFileName}) — מוצגות {scheduleState.data.shifts.length} האחרונות
            מתוכן, לפי {scheduleState.data.dailyFileName}.
          </p>

          {scheduleState.data.shifts.length === 0 ? (
            <p className={styles.state}>לא נמצאו משמרות עבור עובד/ת זה בחודש הנוכחי.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.hourHead}>שעות</th>
                    {scheduleState.data.shifts.map((s) => (
                      <th key={s.day} className={styles.dateHead}>
                        {s.day}.{s.month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleState.data.shifts[0].blocks.map((firstBlock, blockIdx) => (
                    <tr key={blockIdx}>
                      <th className={styles.hourCell}>
                        <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                          {firstBlock.start}–{firstBlock.end}
                        </span>
                      </th>
                      {scheduleState.data.shifts.map((s) => {
                        const block = s.blocks[blockIdx];
                        return (
                          <td
                            key={s.day}
                            className={`${styles.cell} ${block.worked ? styles.worked : styles.notWorked}`}
                          >
                            {block.worked ? "✓" : "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
