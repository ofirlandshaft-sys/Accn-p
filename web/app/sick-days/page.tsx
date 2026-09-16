import type { Metadata } from "next";
import RosterCodeCountReport from "../components/RosterCodeCountReport";

export const metadata: Metadata = {
  title: "מחלה",
  description: "כמה ימי מחלה נספרו לכל עובד/ת, לפי שנה, החל מ-2017.",
};

export default function SickDaysPage() {
  return (
    <RosterCodeCountReport
      title="מחלה"
      description={
        'כמה פעמים כל עובד/ת סומן/ה כ"מחלה" בסידור, לפי שנה — נסרק מהסידור האחרון אחורה עד 2017. ' +
        "הרשימה כוללת רק את העובדים שמופיעים בסידור האחרון."
      }
      codes={["מ", "מ.", ".מ"]}
    />
  );
}
