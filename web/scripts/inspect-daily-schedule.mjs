// One-off exploration script: inspect the structure of a daily-schedule file
// so we know how to parse it, before writing real parsing code.
// Run with: node --env-file=.env.local scripts/inspect-daily-schedule.mjs
import { OAuth2Client } from "google-auth-library";
import ExcelJS from "exceljs";

const DAILY_FOLDER_ID = "0B8vJAzgBs7x1VG1GUDB2VjhIVmc";

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

async function listFolder(auth, folderId) {
  const res = await auth.request({
    url: "https://www.googleapis.com/drive/v3/files",
    params: {
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, modifiedTime)",
      pageSize: 200,
    },
  });
  return res.data.files ?? [];
}

function fmtVal(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("result" in v) v = v.result;
    else if ("richText" in v) v = v.richText.map((t) => t.text).join("");
  }
  if (v instanceof Date) {
    // could be a pure time-of-day (epoch date) or a real date
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
  const files = await listFolder(auth, DAILY_FOLDER_ID);
  const spreadsheetFiles = files
    .filter((f) =>
      ["application/vnd.google-apps.spreadsheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(
        f.mimeType,
      ),
    )
    .sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
  const target = spreadsheetFiles[0];
  console.log(`Inspecting: ${target.name} (${target.id})`);

  const res = await auth.request({
    url: `https://www.googleapis.com/drive/v3/files/${target.id}/export`,
    params: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    responseType: "arraybuffer",
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(res.data));

  const tab = workbook.getWorksheet("1");
  console.log(`\nTab "1": dimensions rows=${tab.rowCount} cols=${tab.columnCount}`);

  console.log("\nMerged cell ranges:");
  const merges = tab.model.merges || [];
  console.log(merges.slice(0, 60).join("\n"));
  console.log(`(${merges.length} total merges)`);

  const maxCol = Math.min(tab.columnCount, 40);
  const maxRow = Math.min(tab.rowCount, 60);
  console.log(`\nFull dump rows 1-${maxRow}, cols 1-${maxCol}:\n`);
  for (let r = 1; r <= maxRow; r++) {
    const row = tab.getRow(r);
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
