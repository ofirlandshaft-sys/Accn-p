import Link from "next/link";
import styles from "./HomeButton.module.css";

/** Small fixed icon-only button, top-right, back to the landing page. Shared by every feature page. */
export default function HomeButton() {
  return (
    <Link href="/" aria-label="חזרה לתפריט הראשי" title="חזרה לתפריט הראשי" className={styles.button}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
        <path d="M9.5 20v-6h5v6" />
      </svg>
    </Link>
  );
}
