export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
  "video/mpeg",
]);

const TEXT_MIMES = new Set(["text/plain", "text/markdown"]);
const PDF_MIME = "application/pdf";

type DriveListResponse = {
  files?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    modifiedTime?: string;
  }>;
  nextPageToken?: string;
};

function mapDriveFile(file: NonNullable<DriveListResponse["files"]>[number]): DriveItem | null {
  if (!file.id || !file.name || !file.mimeType) return null;
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: file.mimeType === FOLDER_MIME,
    size: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime ?? null,
  };
}

async function listDriveFiles(
  accessToken: string,
  query: string
): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
      pageSize: "100",
      orderBy: "folder,name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive API list failed: ${err}`);
    }

    const data = (await res.json()) as DriveListResponse;
    for (const file of data.files ?? []) {
      const mapped = mapDriveFile(file);
      if (mapped) items.push(mapped);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

export async function listDriveFolders(
  accessToken: string,
  parentId?: string | null
): Promise<DriveItem[]> {
  const parentQuery = parentId
    ? `'${parentId}' in parents`
    : "'root' in parents";
  const query = `${parentQuery} and mimeType='${FOLDER_MIME}' and trashed=false`;
  return listDriveFiles(accessToken, query);
}

export async function listDriveFolderContents(
  accessToken: string,
  folderId: string
): Promise<DriveItem[]> {
  const query = `'${folderId}' in parents and trashed=false`;
  return listDriveFiles(accessToken, query);
}

export function isDriveVideo(item: DriveItem): boolean {
  return VIDEO_MIMES.has(item.mimeType) || item.mimeType.startsWith("video/");
}

export function isDrivePdf(item: DriveItem): boolean {
  return item.mimeType === PDF_MIME;
}

export function isDriveText(item: DriveItem): boolean {
  return TEXT_MIMES.has(item.mimeType) || item.name.toLowerCase().endsWith(".txt");
}

export function isDriveProcessable(item: DriveItem): boolean {
  return isDriveVideo(item) || isDrivePdf(item) || isDriveText(item);
}

export async function downloadDriveFile(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive download failed: ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
