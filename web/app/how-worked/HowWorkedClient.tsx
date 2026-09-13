"use client";

import { useEffect, useState } from "react";
import HomeButton from "../components/HomeButton";
import styles from "./HowWorkedClient.module.css";

interface Column {
  day: number;
  month: number;
  year: number;
  shiftManager: string;
}

interface Row {
  start: string;
  end: string;
}

interface ScheduleTable {
  /** Columns sharing an identical hour scheme, so this table's rows need no more granularity than they do. */
  columns: Column[];
  rows: Row[];
  /** worked[rowIndex][columnIndex], local to this table. */
  worked: boolean[][];
}

interface ScheduleResponse {
  employee: string;
  totalWorkDaysThisMonth: number;
  monthsSpanned: number;
  /** Days with a different hour scheme than the rest render as separate tables. */
  tables: ScheduleTable[];
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
    setCount(null); // always require an explicit (re-)choice of count per employee
    setScheduleState({ status: "idle" });
  }

  function handleSelectCount(n: number) {
    setCount(n);
    if (selectedEmployee) setScheduleState({ status: "loading" });
  }

  return (
    <div className={styles.page}>
      <HomeButton />

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
            {scheduleState.data.employee} עבד/ה {scheduleState.data.totalWorkDaysThisMonth} משמרות החודש —
            מוצגות {scheduleState.data.tables.reduce((sum, t) => sum + t.columns.length, 0)} המשמרות האחרונות
            {scheduleState.data.monthsSpanned > 1
              ? ` (נאספו מ-${scheduleState.data.monthsSpanned} חודשים אחורה, כי לא היו מספיק החודש).`
              : "."}
          </p>

          {scheduleState.data.tables.length === 0 ? (
            <p className={styles.state}>לא נמצאו משמרות עבור עובד/ת זה.</p>
          ) : (
            scheduleState.data.tables.map((table, tableIdx) => (
              <div key={tableIdx} className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.hourHead}>שעות</th>
                      {table.columns.map((c) => (
                        <th key={`${c.year}-${c.month}-${c.day}`} className={styles.dateHead}>
                          <span className={styles.dateLine}>
                            {c.day}.{c.month}
                          </span>
                          {c.shiftManager && <span className={styles.managerLine}>{c.shiftManager}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        <th className={styles.hourCell}>
                          <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                            {row.start}–{row.end}
                          </span>
                        </th>
                        {table.columns.map((c, colIdx) => {
                          const worked = table.worked[rowIdx][colIdx];
                          return (
                            <td
                              key={`${c.year}-${c.month}-${c.day}`}
                              className={`${styles.cell} ${worked ? styles.worked : styles.notWorked}`}
                            >
                              {worked ? "✓" : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
