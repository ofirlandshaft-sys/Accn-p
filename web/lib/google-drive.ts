import "server-only";
import type { OAuth2Client } from "google-auth-library";
import { getAuthClient } from "./google-auth";
import { parseHebrewMonthYear, monthSortKey } from "./hebrew-months";
import type { ScheduleFile } from "./schedule-files";

// "סידור נוכחי" — recent months, flat list of files.
const CURRENT_FOLDER_ID = "0B8vJAzgBs7x1TW8tM29YVWlyY1k";
// "סידורים ישנים" — older months, grouped into one subfolder per year.
const ARCHIVE_FOLDER_ID = "0B8vJAzgBs7x1S0lMZVhFT0lyRVU";

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface DriveFilesListResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

/** Lists the immediate (non-recursive) children of a Drive folder, paginated. */
export async function listChildren(auth: OAuth2Client, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await auth.request<DriveFilesListResponse>({
      url: "https://www.googleapis.com/drive/v3/files",
      params: {
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      },
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

function toScheduleFile(f: DriveFile, source: ScheduleFile["source"]): ScheduleFile {
  const parsed = parseHebrewMonthYear(f.name);
  return {
    id: f.id,
    name: f.name,
    year: parsed?.year ?? null,
    month: parsed?.month ?? null,
    modifiedTime: f.modifiedTime,
    source,
  };
}

/**
 * Lists every roster spreadsheet from both Drive folders (the current-months
 * folder, plus every year-subfolder under the archive folder), sorted newest
 * first. Always hits the Drive API live — never cached — because files get
 * moved between these folders from time to time.
 */
export async function listScheduleFiles(): Promise<ScheduleFile[]> {
  const auth = getAuthClient();

  const [currentChildren, archiveTopChildren] = await Promise.all([
    listChildren(auth, CURRENT_FOLDER_ID),
    listChildren(auth, ARCHIVE_FOLDER_ID),
  ]);

  const currentFiles = currentChildren
    .filter((f) => SPREADSHEET_MIME_TYPES.has(f.mimeType))
    .map((f) => toScheduleFile(f, "current"));

  const archiveYearFolders = archiveTopChildren.filter((f) => f.mimeType === FOLDER_MIME_TYPE);
  const archiveDirectFiles = archiveTopChildren.filter((f) => SPREADSHEET_MIME_TYPES.has(f.mimeType));

  const archiveYearFilesLists = await Promise.all(
    archiveYearFolders.map((folder) => listChildren(auth, folder.id)),
  );

  const archiveFiles = [...archiveDirectFiles, ...archiveYearFilesLists.flat()]
    .filter((f) => SPREADSHEET_MIME_TYPES.has(f.mimeType))
    .map((f) => toScheduleFile(f, "archive"));

  // De-dupe by id, in case a file somehow shows up via both folders.
  const byId = new Map<string, ScheduleFile>();
  for (const f of [...currentFiles, ...archiveFiles]) byId.set(f.id, f);
  const files = [...byId.values()];

  files.sort((a, b) => {
    const aKey = monthSortKey(a.year != null && a.month != null ? { year: a.year, month: a.month } : null);
    const bKey = monthSortKey(b.year != null && b.month != null ? { year: b.year, month: b.month } : null);
    if (aKey != null && bKey != null) return bKey - aKey;
    if (aKey != null) return -1; // parsed names sort before unparsable ones
    if (bKey != null) return 1;
    // Neither name parsed — fall back to most-recently-modified first.
    return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
  });

  return files;
}
