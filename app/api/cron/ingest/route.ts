import { NextRequest, NextResponse } from "next/server";

import { CINII_KEYWORDS, fetchCiniiPapers, normalizeCiniiEntry } from "@/lib/cinii";
import { isCronAuthorized } from "@/lib/cron-auth";
import { translateToKorean } from "@/lib/openrouter";
import { getServiceSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 한 번 실행할 때 번역에 쓰는 논문 수를 제한해서 AI 비용을 예측 가능한 범위로 묶어둔다.
const MAX_TRANSLATE_PER_RUN = 60;
const COUNT_PER_KEYWORD = 30;
// CiNii가 짧은 시간에 연속 요청을 보내면 503으로 막는 경우가 있어 키워드 사이에 살짝 쉬어준다.
const DELAY_BETWEEN_KEYWORDS_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const summary: Record<string, unknown>[] = [];
  let translateBudgetLeft = MAX_TRANSLATE_PER_RUN;

  for (const [index, kw] of CINII_KEYWORDS.entries()) {
    if (index > 0) await sleep(DELAY_BETWEEN_KEYWORDS_MS);

    let fetchedCount = 0;
    let newCount = 0;
    let insertedCount = 0;
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
            status = "error";
            errorMessage = `저장 실패: ${insertErr.message}`;
          } else {
            insertedCount += 1;
          }
        }
      }
    } catch (e) {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`CiNii ingest failed for keyword "${kw.label}"`, e);
    }

    const { error: logErr } = await supabase.from("cinii_sync_log").insert({
      keyword: kw.label,
      fetched_count: fetchedCount,
      new_count: insertedCount,
      translated_count: translatedCount,
      status,
      error_message: errorMessage,
    });
    if (logErr) console.error("sync_log insert failed", logErr.message);

    summary.push({
      keyword: kw.label,
      fetchedCount,
      newCount,
      insertedCount,
      translatedCount,
      status,
      errorMessage,
    });
  }

  return NextResponse.json({ ok: true, summary });
}
