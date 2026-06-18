import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type ProbeStorageBucketOptions = {
  supabase: SupabaseClient<Database>;
  bucket: string;
  probePath: string;
  userId: string;
  logPrefix: string;
};

export async function probeStorageBucketWrite({
  supabase,
  bucket,
  probePath,
  userId,
  logPrefix,
}: ProbeStorageBucketOptions): Promise<boolean> {
  console.info(`${logPrefix} bucket probe started`, { bucket, userId, probePath });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(probePath, "ok", {
    contentType: "text/plain",
    upsert: true,
  });

  if (uploadError) {
    console.warn(`${logPrefix} bucket probe failed`, {
      step: "upload",
      bucket,
      userId,
      probePath,
      error: uploadError.message,
    });
    return false;
  }

  console.info(`${logPrefix} bucket probe upload ok`, { bucket, userId, probePath });

  const { error: removeError } = await supabase.storage.from(bucket).remove([probePath]);

  if (removeError) {
    console.warn(`${logPrefix} bucket probe failed`, {
      step: "remove",
      bucket,
      userId,
      probePath,
      error: removeError.message,
    });
    return true;
  }

  console.info(`${logPrefix} bucket probe remove ok`, { bucket, userId, probePath });
  return true;
}
