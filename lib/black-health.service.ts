import { listSystemLogs } from "@/lib/logs/system-log.service";
import {
  buildBlackHealthSnapshots,
  extractFeedInspectorRows,
  type BlackHealthCardSnapshot,
  type FeedInspectorRow,
} from "@/utils/black-health";

export async function getBlackHealthDashboard(): Promise<{
  cards: BlackHealthCardSnapshot[];
  error: string | null;
}> {
  const { logs, error } = await listSystemLogs({ limit: 2000 });
  if (error) return { cards: [], error };

  return {
    cards: buildBlackHealthSnapshots(logs),
    error: null,
  };
}

export async function getFeedInspectorRows(): Promise<{
  rows: FeedInspectorRow[];
  error: string | null;
}> {
  const { logs, error } = await listSystemLogs({ limit: 2000 });
  if (error) return { rows: [], error };

  return {
    rows: extractFeedInspectorRows(logs),
    error: null,
  };
}
