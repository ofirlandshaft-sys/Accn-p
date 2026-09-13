import type { Metadata } from "next";
import HowWorkedClient from "./HowWorkedClient";

export const metadata: Metadata = {
  title: "איך עבד X?",
  description: "באילו שעות עובד היה משובץ במשמרות האחרונות שלו, לפי הסידור היומי.",
};

export default function HowWorkedPage() {
  return <HowWorkedClient />;
}
