// Demo variant: instead of forcing every selected day into one shared
// fine-grained grid (which can produce lots of narrow split rows when one
// day's block scheme doesn't match the others), group days by their block
// boundaries first and render one table per group — each table only as
// fine-grained as the days actually inside it.
// Run with: node --env-file=.env.local scripts/demo-employee-days-grouped.mjs <fileId> <employee> <day1,day2,...>
import { OAuth2Client } from "google-auth-library";
import ExcelJS from "exceljs";

const fileId = process.argv[2];
const employee = process.argv[3];
const days = process.argv[4].split(",").map(Number);

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

// A day's "shape" = the sorted list of its block boundaries (as minute
// offsets). Two days with the same shape need no splitting when shown
// together; a day with a different shape gets its own table instead.
function boundarySignature(blocks) {
  const bounds = new Set();
  for (const b of blocks) {
    const start = minutesSinceCycleStart(b.start);
    let end = minutesSinceCycleStart(b.end);
    if (start == null || end == null) continue;
    if (end === 0) end = CYCLE_MINUTES;
    bounds.add(start);
    bounds.add(end);
  }
  return [...bounds].sort((a, b) => a - b).join(",");
}

async function main() {
  const auth = getAuth();
  const res = await auth.request({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}/export`,
    params: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    responseType: "arraybuffer",
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(res.data));

  const perDay = [];
  for (const day of days) {
    const ws = wb.getWorksheet(String(day));
    if (!ws) {
      console.log(`Day ${day}: tab not found!`);
      continue;
    }
    const blocks = extractBlocksFromSheet(ws, employee);
    perDay.push({ day, blocks, sig: boundarySignature(blocks) });
  }

  // Group days that share an identical block scheme; each group becomes its own table.
  const groups = new Map(); // sig -> {day, blocks}[]
  for (const d of perDay) {
    if (!groups.has(d.sig)) groups.set(d.sig, []);
    groups.get(d.sig).push(d);
  }

  console.log(`\n${employee}: ${days.join(",")} split into ${groups.size} table(s) by matching hour scheme:\n`);

  let tableNum = 1;
  for (const [, groupDays] of groups) {
    const groupDayNums = groupDays.map((d) => d.day);
    const grid = buildUnifiedGrid(groupDays.map((d) => d.blocks));
    console.log(`--- טבלה ${tableNum}: ימים ${groupDayNums.join(", ")} (${grid.rows.length} שורות, אותו מבנה שעות) ---`);
    const header = "שעות".padEnd(14) + groupDayNums.map((d) => `  ${d}.1`).join("");
    console.log(header);
    grid.rows.forEach((row, i) => {
      const label = `${row.start}-${row.end}`.padEnd(14);
      const cells = groupDayNums.map((_, colIdx) => (grid.worked[i][colIdx] ? "   ✓" : "   -"));
      console.log(label + cells.join(""));
    });
    console.log("");
    tableNum++;
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
