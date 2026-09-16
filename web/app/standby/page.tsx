import type { Metadata } from "next";
import RosterCodeCountReport from "../components/RosterCodeCountReport";

export const metadata: Metadata = {
  title: "כוננויות",
  description: "כמה כוננויות נספרו לכל עובד/ת, לפי שנה, החל מ-2017.",
};

export default function StandbyPage() {
  return (
    <RosterCodeCountReport
      title="כוננויות"
      description={
        'כמה פעמים כל עובד/ת סומן/ה ככונן (s / s1 / s2 / s3) בסידור, לפי שנה — נסרק מהסידור האחרון אחורה עד 2017. ' +
        "הרשימה כוללת רק את העובדים שמופיעים בסידור האחרון."
      }
      codes={["s", "s1", "s2", "s3"]}
    />
  );
}
