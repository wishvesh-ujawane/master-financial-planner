import type { PlanData } from './planner-store';

const BACKUP_FILENAME = 'goodmeasure-backup.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export type BackupEnvelope = { schema: 'goodmeasure/v2'; exportedAt: string; plan: PlanData };
export type BackupMeta = { id: string; modifiedTime: string };

async function driveError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message || `Google Drive request failed (${response.status}).`;
  } catch {
    return `Google Drive request failed (${response.status}).`;
  }
}

async function findBackup(token: string): Promise<BackupMeta | null> {
  const query = encodeURIComponent(`name='${BACKUP_FILENAME}'`);
  const url = `${DRIVE_FILES}?spaces=appDataFolder&q=${query}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await driveError(response));
  const data = (await response.json()) as { files?: BackupMeta[] };
  return data.files?.[0] ?? null;
}

export function getBackupMeta(token: string): Promise<BackupMeta | null> {
  return findBackup(token);
}

export async function backupToDrive(token: string, plan: PlanData): Promise<BackupMeta> {
  const payload: BackupEnvelope = { schema: 'goodmeasure/v2', exportedAt: new Date().toISOString(), plan };
  const existing = await findBackup(token);
  if (existing) {
    const response = await fetch(`${DRIVE_UPLOAD}/${existing.id}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await driveError(response));
    return (await response.json()) as BackupMeta;
  }
  const boundary = `gm-${Math.random().toString(36).slice(2)}`;
  const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;
  const response = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) throw new Error(await driveError(response));
  return (await response.json()) as BackupMeta;
}

export async function restoreFromDrive(token: string): Promise<BackupEnvelope | null> {
  const existing = await findBackup(token);
  if (!existing) return null;
  const response = await fetch(`${DRIVE_FILES}/${existing.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await driveError(response));
  return (await response.json()) as BackupEnvelope;
}
