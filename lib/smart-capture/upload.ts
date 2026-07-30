/**
 * Upload progress tracking — bar, ETA, cancel, retry.
 */

import {
  newSmartCaptureId,
  type UploadProgress,
  type UploadStatus,
} from "@/lib/smart-capture/types";

export function createUploadProgress(
  fileName: string,
  bytesTotal: number
): UploadProgress {
  return {
    id: newSmartCaptureId("up"),
    fileName,
    percent: 0,
    status: "queued",
    startedAt: null,
    endedAt: null,
    estimatedSecondsLeft: null,
    error: null,
    bytesLoaded: 0,
    bytesTotal,
  };
}

export function startUpload(progress: UploadProgress): UploadProgress {
  return {
    ...progress,
    status: "uploading",
    startedAt: new Date().toISOString(),
    error: null,
  };
}

export function tickUpload(
  progress: UploadProgress,
  bytesLoaded: number,
  nowMs = Date.now()
): UploadProgress {
  const total = Math.max(progress.bytesTotal, 1);
  const loaded = Math.min(bytesLoaded, total);
  const percent = Math.round((loaded / total) * 100);
  let estimatedSecondsLeft: number | null = null;
  if (progress.startedAt && loaded > 0) {
    const elapsed = Math.max(1, nowMs - Date.parse(progress.startedAt)) / 1000;
    const rate = loaded / elapsed;
    estimatedSecondsLeft = Math.max(0, Math.round((total - loaded) / rate));
  }
  return {
    ...progress,
    bytesLoaded: loaded,
    percent,
    estimatedSecondsLeft,
    status: "uploading",
  };
}

export function completeUpload(progress: UploadProgress): UploadProgress {
  return {
    ...progress,
    percent: 100,
    bytesLoaded: progress.bytesTotal,
    status: "done",
    endedAt: new Date().toISOString(),
    estimatedSecondsLeft: 0,
    error: null,
  };
}

export function failUpload(
  progress: UploadProgress,
  error: string
): UploadProgress {
  return {
    ...progress,
    status: "error",
    error,
    endedAt: new Date().toISOString(),
    estimatedSecondsLeft: null,
  };
}

export function cancelUpload(progress: UploadProgress): UploadProgress {
  return {
    ...progress,
    status: "cancelled",
    endedAt: new Date().toISOString(),
    estimatedSecondsLeft: null,
    error: "Cancelado",
  };
}

export function retryUpload(progress: UploadProgress): UploadProgress {
  return {
    ...progress,
    status: "queued",
    percent: 0,
    bytesLoaded: 0,
    startedAt: null,
    endedAt: null,
    estimatedSecondsLeft: null,
    error: null,
  };
}

export function isTerminalUploadStatus(status: UploadStatus): boolean {
  return status === "done" || status === "error" || status === "cancelled";
}

/** Parallel upload runner with concurrency limit. */
export async function runParallelUploads<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = 3
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  let cursor = 0;

  async function next(): Promise<void> {
    const current = cursor++;
    if (current >= queue.length) return;
    const { item, index } = queue[current];
    await worker(item, index);
    await next();
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => next()
  );
  await Promise.all(workers);
}
