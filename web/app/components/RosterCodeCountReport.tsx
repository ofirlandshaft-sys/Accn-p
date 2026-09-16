"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "./HomeButton";
import styles from "./RosterCodeCountReport.module.css";

export interface RosterCodeCountReportProps {
  /** Page heading, e.g. "מחלה" or "כוננויות". */
  title: string;
  /** Lede paragraph under the heading. {oldestYear} in the text is not auto-substituted — write the year in directly. */
  description: string;
  /** Exact roster cell-text values to count, e.g. ["מ", "מ.", ".מ"] or ["s", "s1", "s2", "s3"]. */
  codes: string[];
  /**
   * Earliest year to scan back to (inclusive). Roster files older than 2017
   * use a sheet layout `lib/sheets.ts`'s parseRoster can't read (see
   * CLAUDE.md's "The roster-code-count reports" section) — 2017 is the
   * confirmed-reliable floor for every report built on this component so
   * far; only override this if a specific report has been separately
   * verified against older data.
   */
  oldestYear?: number;
}

type EmployeesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; names: string[] };

interface Row {
  name: string;
  /** counts[i] corresponds to `years[i]`. */
  counts: number[];
  total: number;
}

/**
 * Generic "count occurrences of these exact roster codes per employee, per
 * year, back to a cutoff year" report — right-aligned employee list sorted
 * by total descending, one column per year (current year first, oldest
 * last), total column at the far left. Backs both "מחלה" (`/sick-days`) and
 * "כוננויות" (`/standby`); reuse this for any future report shaped the same
 * way rather than copy-pasting it.
 */
export default function RosterCodeCountReport({ title, description, codes, oldestYear = 2017 }: RosterCodeCountReportProps) {
  const [employeesState, setEmployeesState] = useState<EmployeesState>({ status: "loading" });
  const [years, setYears] = useState<number[]>([]);
  const [countsByEmployee, setCountsByEmployee] = useState<Map<string, number[]> | null>(null);
  const [yearsScanned, setYearsScanned] = useState(0);
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [unreliableYears, setUnreliableYears] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);

  const codesKey = codes.join(",");

  useEffect(() => {
    let cancelled = false;
    const currentYear = new Date().getFullYear();
    const yearList: number[] = [];
    for (let y = currentYear; y >= oldestYear; y--) yearList.push(y);
    const codesParam = encodeURIComponent(codesKey);

    fetch("/api/employees", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `שגיאת שרת (${res.status})`);
        if (cancelled) return;

        const names: string[] = data.names;
        const nameSet = new Set(names);
        const counts = new Map<string, number[]>(names.map((n) => [n, new Array(yearList.length).fill(0)]));

        setEmployeesState({ status: "ready", names });
        setYears(yearList);
        setCountsByEmployee(new Map(counts));

        // One year per request, sequentially — see the comment on
        // listScheduleFilesForYear() for why: scanning every year in a
        // single request measured at 14+ seconds, over what Vercel's
        // serverless functions allow. Each year-request here stays small
        // and fast, and the table fills in / re-sorts as results arrive
        // instead of showing nothing until the whole scan finishes.
        for (let i = 0; i < yearList.length; i++) {
          if (cancelled) return;
          const year = yearList[i];
          try {
            const yearRes = await fetch(`/api/roster-code-counts?year=${year}&codes=${codesParam}`, {
              cache: "no-store",
            });
            const yearData = await yearRes.json();
            if (!yearRes.ok) throw new Error(yearData?.error ?? `שגיאת שרת (${yearRes.status})`);
            if (cancelled) return;

            const yearCounts: Record<string, number> = yearData.counts ?? {};
            for (const [name, count] of Object.entries(yearCounts)) {
              if (!nameSet.has(name)) continue; // per Ofir: ignore names not on the newest roster
              counts.get(name)![i] += count;
            }
            setCountsByEmployee(new Map(counts));

            // Some older files use a different sheet layout the parser doesn't
            // recognize — when every file for a year failed, or there were
            // none at all, that year's "0" would be misleading (it means
            // "couldn't read", not "no occurrences"). Mark it so the table
            // shows that honestly.
            const filesScanned = yearData.filesScanned ?? 0;
            const filesFailed = yearData.filesFailed ?? 0;
            if (filesScanned === 0 || filesFailed === filesScanned) {
              setUnreliableYears((prev) => new Set(prev).add(year));
            }
          } catch (err) {
            if (!cancelled) {
              const message = err instanceof Error ? err.message : "שגיאה לא ידועה";
              setScanErrors((prev) => [...prev, `${year}: ${message}`]);
            }
          }
          if (!cancelled) setYearsScanned(i + 1);
        }
        if (!cancelled) setDone(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codesKey stands in for `codes` (a fresh array every render)
  }, [codesKey, oldestYear]);

  const rows: Row[] = useMemo(() => {
    if (!countsByEmployee) return [];
    const list = [...countsByEmployee.entries()].map(([name, counts]) => ({
      name,
      counts,
      total: counts.reduce((a, b) => a + b, 0),
    }));
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [countsByEmployee]);

  return (
    <div className={styles.page}>
      <HomeButton />

      <header className={styles.top}>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.lede}>{description}</p>
      </header>

      {employeesState.status === "loading" && <p className={styles.state}>טוען רשימת עובדים…</p>}
      {employeesState.status === "error" && (
        <p className={`${styles.state} ${styles.error}`}>שגיאה בטעינת עובדים: {employeesState.message}</p>
      )}

      {employeesState.status === "ready" && (
        <>
          <p className={styles.meta}>
            {employeesState.names.length} עובדים —{" "}
            {done
              ? `נסרקו ${years.length} שנים (${years[years.length - 1]}–${years[0]}).`
              : `סורק שנים… (${yearsScanned}/${years.length})`}
          </p>

          {scanErrors.length > 0 && (
            <p className={`${styles.state} ${styles.error}`}>
              לא ניתן היה לסרוק {scanErrors.length} שנים: {scanErrors.join(" · ")}
            </p>
          )}

          {done && unreliableYears.size > 0 && (
            <p className={`${styles.state} ${styles.warn}`}>
              לתשומת לבך: הקבצים לשנים המסומנות ב-&quot;?&quot; ({[...unreliableYears].sort((a, b) => a - b).join(", ")}
              ) בנויים במבנה ישן שהמערכת לא יודעת לקרוא כרגע, ולכן אין להם נתונים אמינים — זה לא בהכרח אומר 0.
            </p>
          )}

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.nameHead}>עובד/ת</th>
                  {years.map((y) => (
                    <th
                      key={y}
                      className={styles.yearHead}
                      title={unreliableYears.has(y) ? "מבנה קובץ ישן — אין נתונים אמינים לשנה זו" : undefined}
                    >
                      {y}
                      {unreliableYears.has(y) && <span className={styles.unreliableMark}>?</span>}
                    </th>
                  ))}
                  <th className={styles.totalHead}>סה&quot;כ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <th className={styles.nameCell}>{row.name}</th>
                    {row.counts.map((count, i) =>
                      unreliableYears.has(years[i]) ? (
                        <td key={years[i]} className={`${styles.cell} ${styles.unavailable}`} title="אין נתונים אמינים">
                          –
                        </td>
                      ) : (
                        <td key={years[i]} className={`${styles.cell} ${count === 0 ? styles.zero : ""}`}>
                          {count}
                        </td>
                      ),
                    )}
                    <td className={styles.totalCell}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
