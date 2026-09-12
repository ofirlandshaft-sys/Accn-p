"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./ShiftMatrix.module.css";
import type { MatrixData } from "@/lib/matrix-types";

interface ShiftMatrixProps {
  data: MatrixData;
  /** Calendar month number (1-12) the data covers, used to format dates like "4.9". */
  month?: number;
}

interface HoveredCell {
  row: number;
  col: number;
}

/**
 * Heatmap background for a cell with overlap count `v` (out of `maxVal`).
 * Uses CSS `light-dark()` so the right shade picks itself from the browser's
 * color-scheme with no client-side theme detection (no hydration mismatch).
 */
function heatColor(v: number, maxVal: number): string | undefined {
  if (v <= 0 || maxVal <= 0) return undefined;
  const t = v / maxVal;
  const alphaLight = (0.16 + t * 0.62).toFixed(3);
  const alphaDark = (0.14 + t * 0.55).toFixed(3);
  return `light-dark(rgba(79,70,229,${alphaLight}), rgba(129,140,248,${alphaDark}))`;
}

export default function ShiftMatrix({ data, month = 9 }: ShiftMatrixProps) {
  const { names, matrix, rowSums, shifts, pairDays } = data;
  const n = names.length;
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const row of matrix) for (const v of row) if (v > max) max = v;
    return max;
  }, [matrix]);

  const colSums = useMemo(() => {
    const sums = new Array(n).fill(0) as number[];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sums[j] += matrix[i][j];
    return sums;
  }, [matrix, n]);

  const grandTotal = useMemo(() => colSums.reduce((a, b) => a + b, 0) / 2, [colSums]);
  const daysInMonth = useMemo(() => {
    let max = 0;
    for (const days of Object.values(pairDays)) for (const d of days) if (d > max) max = d;
    return max || 30;
  }, [pairDays]);

  function clearHover() {
    setHovered(null);
  }

  let readoutMsg: ReactNode =
    "העבירו עכבר מעל תא בטבלה כדי לראות פרטי זוג ותאריכים (או הקישו על תא במסך מגע)";
  let readoutDates = "";

  if (hovered) {
    const { row: i, col: j } = hovered;
    if (i === j) {
      readoutMsg = (
        <>
          <span className={styles.name}>{names[i]}</span> — עובד/ת אחד/ת
        </>
      );
    } else {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const days = pairDays[key] ?? [];
      if (days.length === 0) {
        readoutMsg = (
          <>
            <span className={styles.name}>{names[i]}</span> ו<span className={styles.name}>{names[j]}</span> —{" "}
            <span className={styles.count}>0</span> מתוך {shifts[i]} המשמרות של {names[i]} חפפו
          </>
        );
      } else {
        readoutMsg = (
          <>
            <span className={styles.name}>{names[i]}</span> ו<span className={styles.name}>{names[j]}</span> —{" "}
            <span className={styles.count}>{days.length}</span> מתוך {shifts[i]} המשמרות של {names[i]} חפפו עם{" "}
            {names[j]}
          </>
        );
        readoutDates = "תאריכים: " + days.map((d) => `${d}.${month}`).join(", ");
      }
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <h1 className={styles.h1}>מטריצת שותפי משמרת</h1>
        <p className={styles.lede}>
          כל תא מציג <b>ימים משותפים / סך המשמרות</b> של עובד השורה — כלומר, בכמה מהמשמרות שלו הוא חפף עם עובד העמודה,
          מתוך סך המשמרות שלו החודש (לפי עמודת &quot;מש&apos;&quot; בסידור). הסדר תואם את סדר השמות בסידור המקורי.
        </p>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statN}>{n}</span>
            <span className={styles.statL}>עובדים בסידור</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{maxVal}</span>
            <span className={styles.statL}>מקסימום ימים משותפים לזוג</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statN}>{daysInMonth}</span>
            <span className={styles.statL}>ימים בחודש</span>
          </div>
        </div>
      </header>

      <div className={styles.panel}>
        <div className={`${styles.readout} ${!hovered ? styles.readoutEmpty : ""}`}>
          <div className={styles.msg}>{readoutMsg}</div>
          <div className={styles.dates}>{readoutDates}</div>
        </div>

        <div className={styles.legend}>
          <span>עצימות:</span>
          <div className={styles.swaps}>
            {Array.from({ length: maxVal + 1 }, (_, lv) => (
              <span
                key={lv}
                className={styles.sw}
                title={`${lv} ימים`}
                style={{ background: lv === 0 ? "transparent" : heatColor(lv, maxVal) }}
              />
            ))}
          </div>
          <span className={styles.legendSpacer}>
            {n}×{n} &nbsp;·&nbsp; גררו לגלילה
          </span>
        </div>

        <div className={styles.tableScroll} onMouseLeave={clearHover}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th className={styles.corner} />
                {names.map((name, j) => (
                  <th key={name} className={`${styles.colhead} ${hovered?.col === j ? styles.colheadHi : ""}`}>
                    <span className={styles.rot}>{name}</span>
                  </th>
                ))}
                <th className={`${styles.corner} ${styles.cornerTotal}`}>סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {names.map((name, i) => (
                <tr key={name}>
                  <th className={`${styles.rowhead} ${hovered?.row === i ? styles.rowheadHi : ""}`}>
                    {name}
                    <span className={styles.rowheadShifts}>· {shifts[i]} מש&apos;</span>
                  </th>
                  {names.map((_, j) => {
                    if (i === j) {
                      return (
                        <td key={j} className={`${styles.cell} ${styles.cellDiag}`}>
                          —
                        </td>
                      );
                    }
                    const v = matrix[i][j];
                    return (
                      <td
                        key={j}
                        className={`${styles.cell} ${v <= 0 ? styles.cellZero : ""}`}
                        style={{ background: v > 0 ? heatColor(v, maxVal) : undefined }}
                        onMouseEnter={() => setHovered({ row: i, col: j })}
                        onClick={() => setHovered({ row: i, col: j })}
                      >
                        {v}
                        <span className={styles.den}>/{shifts[i]}</span>
                      </td>
                    );
                  })}
                  <td className={styles.totalCell}>{rowSums[i]}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className={styles.rowhead}>סה״כ</th>
                {colSums.map((sum, j) => (
                  <td key={j}>{sum}</td>
                ))}
                <td className={styles.grandTotal}>{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <footer className={styles.note}>
        המספרים סופרו מתוך היום בו שני האנשים היו מסומנים <b>x</b> (משמרת בפועל) באותו תאריך — לא בהכרח באותו רכב/עמדה,
        כי הסידור לא מתעד שיבוץ צוותים.
      </footer>
    </div>
  );
}
