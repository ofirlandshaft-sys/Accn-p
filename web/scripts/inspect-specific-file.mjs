// Inspect a specific Drive file + tab by ID, to check for irregular block structure.
// Run with: node --env-file=.env.local scripts/inspect-specific-file.mjs <fileId> <tabName>
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

  console.log("Tabs in file:", workbook.worksheets.map((w) => w.name).join(", "));

  const ws = workbook.getWorksheet(tabName);
  if (!ws) {
    console.log(`Tab "${tabName}" not found.`);
    return;
  }
  console.log(`\nTab "${tabName}": rows=${ws.rowCount} cols=${ws.columnCount}`);

  const maxCol = Math.min(ws.columnCount, 15);
  const maxRow = Math.min(ws.rowCount, 40);
  console.log(`\nDumping rows 1-${maxRow}, cols 1-${maxCol} (focus on C:M block area):\n`);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= maxCol; c++) {
      cells.push(fmtVal(row.getCell(c).value).slice(0, 10));
    }
    console.log(String(r).padStart(2), "|", cells.map((c) => c.padEnd(10)).join("|"));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
