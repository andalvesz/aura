export async function GET() {
  const key = process.env.PLATFORM_CREDENTIALS_KEY;

  return Response.json({
    nodeEnv: process.env.NODE_ENV,
    platformCredentialsKeyConfigured: !!key,
    keyLength: key ? key.length : 0,
  });
}
