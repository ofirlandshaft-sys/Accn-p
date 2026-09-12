import type { Metadata } from "next";
import MonthlyStatsClient from "./MonthlyStatsClient";

export const metadata: Metadata = {
  title: "סטטיסטיקה חודשית",
  description:
    "כמה ימים כל שני עובדים חפפו במשמרת בפועל, לפי סידור העבודה החודשי.",
};

export default function MonthlyStatsPage() {
  return <MonthlyStatsClient />;
}
