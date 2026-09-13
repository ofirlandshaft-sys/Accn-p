// Verifies buildUnifiedGrid correctly merges two real days with DIFFERENT
// block granularities (Jan file's day 2 = 16x1.5h, Sep file's day 1 = 12x2h)
// for the same employee, before trusting the TS implementation.
import { OAuth2Client } from "google-auth-library";
import ExcelJS from "exceljs";

function getAuth() {
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return client;
}

function rawCellValue(v) {
  if (v != null && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
  }
  return v;
}
function cellText(cell) {
  const v = rawCellValue(cell.value);
  return v == null ? "" : String(v).trim();
}
function extractTimeLabel(cell) {
  const v = rawCellValue(cell.value);
  if (v == null) return null;
  if (v instanceof Date) {
    const hh = String(v.getUTCHours()).padStart(2, "0");
    const mm = String(v.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (typeof v === "number") {
    const totalMinutes = Math.round((v % 1) * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim())) return v.trim();
  return null;
}

function extractBlocksFromSheet(ws, employeeName) {
  const blocks = [];
  const START_COL = 3, END_COL = 4, NAME_FIRST = 5, NAME_LAST = 13;
  for (let i = 0, row = 12; i < 48; i++, row += 2) {
    const start = extractTimeLabel(ws.getRow(row).getCell(START_COL));
    const end = extractTimeLabel(ws.getRow(row).getCell(END_COL));
    if (start == null || end == null) break;
    let worked = false;
    for (const r of [row, row + 1]) {
      for (let col = NAME_FIRST; col <= NAME_LAST; col++) {
        if (cellText(ws.getRow(r).getCell(col)) === employeeName) { worked = true; break; }
      }
      if (worked) break;
    }
    blocks.push({ start, end, worked });
  }
  return blocks;
}

// --- port of lib/shift-grid.ts for standalone testing ---
const CYCLE_MINUTES = 24 * 60, CYCLE_START_HOUR = 9;
function minutesSinceCycleStart(hhmm) {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  return (((h * 60 + mm) - CYCLE_START_HOUR * 60) % CYCLE_MINUTES + CYCLE_MINUTES) % CYCLE_MINUTES;
}
function cycleMinutesToLabel(mins) {
  const total = (CYCLE_START_HOUR * 60 + mins) % CYCLE_MINUTES;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
function buildUnifiedGrid(perColumnBlocks) {
  const boundaries = new Set([0, CYCLE_MINUTES]);
  const parsed = perColumnBlocks.map((blocks) =>
    blocks.map((b) => {
      const start = minutesSinceCycleStart(b.start);
      let end = minutesSinceCycleStart(b.end);
      if (start == null || end == null) return null;
      if (end === 0) end = CYCLE_MINUTES;
      return { start, end, worked: b.worked };
    }).filter(Boolean)
  );
  for (const blocks of parsed) for (const b of blocks) { boundaries.add(b.start); boundaries.add(b.end); }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const rows = [];
  for (let i = 0; i < sorted.length - 1; i++) rows.push({ start: cycleMinutesToLabel(sorted[i]), end: cycleMinutesToLabel(sorted[i + 1]) });
  const worked = rows.map(() => perColumnBlocks.map(() => false));
  parsed.forEach((blocks, colIdx) => {
    for (const b of blocks) {
      if (!b.worked) continue;
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        if (sorted[rowIdx] >= b.start && sorted[rowIdx + 1] <= b.end) worked[rowIdx][colIdx] = true;
      }
    }
  });
  return { rows, worked };
}
// --- end port ---

async function downloadWorkbook(auth, fileId) {
  const res = await auth.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
    params: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    responseType: "arraybuffer",
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(res.data));
  return wb;
}

async function main() {
  const auth = getAuth();
  const employee = "אלנבוגן";

  const janWb = await downloadWorkbook(auth, "1SyzUqCup0x6N9-JopoCwM7Mt8K2GfcqNEmR1mBo2itM");
  const janBlocks = extractBlocksFromSheet(janWb.getWorksheet("2"), employee);
  console.log(`Jan day 2 blocks for ${employee} (${janBlocks.length} blocks):`);
  janBlocks.forEach((b) => console.log(`  ${b.start}-${b.end}: ${b.worked ? "WORKED" : "-"}`));

  const sepWb = await downloadWorkbook(auth, "1vnWGkkbsxgeTRz-Y9gy9cFwX7HA1zdcDMr_SspI-F_o");
  const sepBlocks = extractBlocksFromSheet(sepWb.getWorksheet("1"), employee);
  console.log(`\nSep day 1 blocks for ${employee} (${sepBlocks.length} blocks):`);
  sepBlocks.forEach((b) => console.log(`  ${b.start}-${b.end}: ${b.worked ? "WORKED" : "-"}`));

  const grid = buildUnifiedGrid([janBlocks, sepBlocks]);
  console.log(`\nUnified grid (${grid.rows.length} rows):`);
  console.log("row".padEnd(14), "| Jan-2 | Sep-1");
  grid.rows.forEach((row, i) => {
    console.log(
      `${row.start}-${row.end}`.padEnd(14),
      "|",
      (grid.worked[i][0] ? "✓" : "-").padEnd(5),
      "|",
      grid.worked[i][1] ? "✓" : "-",
    );
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
