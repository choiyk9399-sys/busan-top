import { NextRequest, NextResponse } from "next/server";

import { CINII_KEYWORDS, fetchCiniiPapers, normalizeCiniiEntry } from "@/lib/cinii";
import { translateToKorean } from "@/lib/openrouter";
import { getServiceSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 한 번 실행할 때 번역에 쓰는 논문 수를 제한해서 AI 비용을 예측 가능한 범위로 묶어둔다.
const MAX_TRANSLATE_PER_RUN = 60;
const COUNT_PER_KEYWORD = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  // Vercel Cron은 Authorization 헤더로 인증하지만, 사람이 브라우저에서
  // 수동으로 한 번 실행해볼 수 있도록 ?secret=... 쿼리파라미터도 허용한다.
  const querySecret = req.nextUrl.searchParams.get("secret");
  return querySecret === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const summary: Record<string, unknown>[] = [];
  let translateBudgetLeft = MAX_TRANSLATE_PER_RUN;

  for (const kw of CINII_KEYWORDS) {
    let fetchedCount = 0;
    let newCount = 0;
    let translatedCount = 0;
    let status = "success";
    let errorMessage: string | null = null;

    try {
      const { entries } = await fetchCiniiPapers(kw.query, COUNT_PER_KEYWORD);
      fetchedCount = entries.length;

      const papers = entries
        .map((e) => normalizeCiniiEntry(e, kw.label))
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (papers.length > 0) {
        const urls = papers.map((p) => p.ciniiUrl);
        const { data: existing, error: existErr } = await supabase
          .from("cinii_papers")
          .select("cinii_url")
          .in("cinii_url", urls);

        if (existErr) throw new Error(`기존 데이터 조회 실패: ${existErr.message}`);

        const existingUrls = new Set((existing ?? []).map((r) => r.cinii_url));
        const newPapers = papers.filter((p) => !existingUrls.has(p.ciniiUrl));
        newCount = newPapers.length;

        for (const paper of newPapers) {
          let titleKo: string | null = null;
          let abstractKo: string | null = null;
          let translated = false;

          if (translateBudgetLeft > 0) {
            try {
              const result = await translateToKorean(paper.titleJa, paper.abstractJa);
              titleKo = result.titleKo;
              abstractKo = result.abstractKo;
              translated = true;
              translatedCount += 1;
              translateBudgetLeft -= 1;
            } catch (e) {
              // 번역 실패해도 원문(일본어)은 그대로 저장한다
              console.error("translate failed", paper.ciniiUrl, e);
            }
          }

          const { error: insertErr } = await supabase.from("cinii_papers").insert({
            cinii_url: paper.ciniiUrl,
            title_ja: paper.titleJa,
            title_ko: titleKo,
            authors: paper.authors,
            journal: paper.journal,
            abstract_ja: paper.abstractJa,
            abstract_ko: abstractKo,
            published_date: paper.publishedDate,
            keyword: paper.keyword,
            translated,
          });

          if (insertErr) {
            console.error("insert failed", paper.ciniiUrl, insertErr.message);
          }
        }
      }
    } catch (e) {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`CiNii ingest failed for keyword "${kw.label}"`, e);
    }

    await supabase.from("cinii_sync_log").insert({
      keyword: kw.label,
      fetched_count: fetchedCount,
      new_count: newCount,
      translated_count: translatedCount,
      status,
      error_message: errorMessage,
    });

    summary.push({
      keyword: kw.label,
      fetchedCount,
      newCount,
      translatedCount,
      status,
      errorMessage,
    });
  }

  return NextResponse.json({ ok: true, summary });
}
