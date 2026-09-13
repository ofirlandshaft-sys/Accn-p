import { OAuth2Client } from "google-auth-library";
import ExcelJS from "exceljs";

const fileId = process.argv[2];
const tabName = process.argv[3] ?? "1";

function getAuth() {
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return client;
}

function fmtVal(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("result" in v) v = v.result;
    else if ("richText" in v) v = v.richText.map((t) => t.text).join("");
  }
  if (v instanceof Date) {
    const isEpochDate = v.getUTCFullYear() === 1899 && v.getUTCMonth() === 11 && v.getUTCDate() === 30;
    if (isEpochDate) {
      const hh = String(v.getUTCHours()).padStart(2, "0");
      const mm = String(v.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return v.toISOString().slice(0, 10);
  }
  return String(v);
}

async function main() {
  const auth = getAuth();
  const res = await auth.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
    params: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    responseType: "arraybuffer",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(res.data));
  const ws = workbook.getWorksheet(tabName);

  console.log(`Rows 40-70 of tab "${tabName}", cols C,D (start/end):\n`);
  for (let r = 40; r <= 70; r++) {
    const row = ws.getRow(r);
    const c = fmtVal(row.getCell(3).value);
    const d = fmtVal(row.getCell(4).value);
    console.log(String(r).padStart(2), "| C:", c.padEnd(8), "| D:", d.padEnd(8));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
