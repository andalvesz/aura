import { NextResponse } from "next/server";
import { getGoogleRedirectUri } from "@/lib/google-calendar/config";

/** Rota legada — redireciona para o callback ativo. */
export async function GET(request: Request) {
  const source = new URL(request.url);
  const target = new URL(getGoogleRedirectUri());
  source.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  return NextResponse.redirect(target);
}
