import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "התחברות",
};

const ERROR_MESSAGES: Record<string, (email?: string) => string> = {
  not_allowed: (email) => `החשבון${email ? ` ${email}` : ""} לא מורשה להיכנס למערכת הזו.`,
  state: () => "פג תוקף הבקשה, נסו להתחבר שוב.",
  no_email: () => "לא התקבלה כתובת מייל מאומתת מגוגל. נסו שוב.",
  failed: () => "ההתחברות נכשלה. נסו שוב.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const email = typeof params.email === "string" ? params.email : undefined;
  const nextPath = typeof params.next === "string" ? params.next : "/";
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey]?.(email) ?? ERROR_MESSAGES.failed()) : null;

  const loginHref = `/api/auth/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>מערכת סידור עבודה</h1>
        <p className={styles.lede}>הכניסה מוגבלת לחשבונות Google מורשים בלבד.</p>
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        <a className={styles.button} href={loginHref}>
          <GoogleIcon />
          התחברות עם Google
        </a>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
