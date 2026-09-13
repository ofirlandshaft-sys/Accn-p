import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const menuItems = [
  {
    href: "/monthly-stats",
    title: "סטטיסטיקה חודשית",
    hint: "מטריצת שותפי משמרת — כמה ימים כל שני עובדים חפפו החודש",
  },
  {
    href: "/how-worked",
    title: "איך עבד X?",
    hint: "באילו שעות עובד/ת היה/תה משובץ/ת במשמרות האחרונות שלו/ה",
  },
];

export default function Home() {
  return (
    <div className={styles.hero}>
      <Image
        src="/images/rsz_870_420_natbb.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.bg}
      />
      <div className={styles.scrim} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>מערכת סידור עבודה</p>
        <h1 className={styles.title}>ניהול ומעקב סידור</h1>
        <p className={styles.lede}>
          כלים לניתוח סידור העבודה החודשי — התחילו מהאופציה הזמינה למטה.
        </p>
        <nav className={styles.menu} aria-label="תפריט ראשי">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.menuItem}>
              <span className={styles.menuText}>
                <span className={styles.menuTitle}>{item.title}</span>
                <span className={styles.menuHint}>{item.hint}</span>
              </span>
              <span className={styles.menuArrow} aria-hidden="true">
                ‹
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <a href="/api/auth/logout" className={styles.logout}>
        התנתקות
      </a>
    </div>
  );
}
