import { NextRequest } from "next/server";

/** Vercel Cron(Authorization 헤더) 또는 사람이 브라우저에서 수동 실행(?secret=...)할 때 인증한다. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  const querySecret = req.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}
