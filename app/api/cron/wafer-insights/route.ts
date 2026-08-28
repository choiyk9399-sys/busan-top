import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { generateWaferInsight } from "@/lib/openrouter";
import { getServiceSupabaseClient } from "@/lib/supabase";
import { getArticlesForCompany, getWaferCompanies } from "@/lib/wafer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 회사당 하루 1회만 새로 생성해서 AI 비용을 하루 몇 원 수준으로 묶어둔다.
const MIN_HOURS_BETWEEN_INSIGHTS = 20;
const MAX_ARTICLES_PER_COMPANY = 12;
const SINCE_DAYS = 14;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();
  const companies = await getWaferCompanies(supabase);
  const summary: Record<string, unknown>[] = [];

  for (const company of companies) {
    let matchedCount = 0;
    let status = "success";
    let errorMessage: string | null = null;

    try {
      const { data: lastInsight } = await supabase
        .from("wafer_insights")
        .select("generated_at")
        .eq("company_slug", company.slug)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const hoursSinceLast = lastInsight
        ? (Date.now() - new Date(lastInsight.generated_at).getTime()) / 3_600_000
        : Infinity;

      if (hoursSinceLast < MIN_HOURS_BETWEEN_INSIGHTS) {
        status = "skipped_recent";
        summary.push({ company: company.slug, status, matchedCount });
        continue;
      }

      const articles = await getArticlesForCompany(supabase, company, {
        limit: MAX_ARTICLES_PER_COMPANY,
        sinceDays: SINCE_DAYS,
      });
      matchedCount = articles.length;

      if (matchedCount === 0) {
        status = "no_data";
        summary.push({ company: company.slug, status, matchedCount });
        const { error: logErr } = await supabase.from("wafer_sync_log").insert({
          company_slug: company.slug,
          matched_count: matchedCount,
          status,
        });
        if (logErr) console.error("wafer_sync_log insert failed", logErr.message);
        continue;
      }

      const insightKo = await generateWaferInsight(
        company.name_ko,
        articles.map((a) => ({
          title: a.title,
          summary: a.summary_ko,
          source: a.source,
          date: a.published_at ? a.published_at.slice(0, 10) : null,
        }))
      );

      const { error: insertErr } = await supabase.from("wafer_insights").insert({
        company_slug: company.slug,
        insight_ko: insightKo,
        based_on_count: matchedCount,
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
      });
      if (insertErr) throw new Error(`저장 실패: ${insertErr.message}`);
    } catch (e) {
      status = "error";
      errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`wafer insight generation failed for "${company.slug}"`, e);
    }

    const { error: logErr } = await supabase.from("wafer_sync_log").insert({
      company_slug: company.slug,
      matched_count: matchedCount,
      status,
      error_message: errorMessage,
    });
    if (logErr) console.error("wafer_sync_log insert failed", logErr.message);

    summary.push({ company: company.slug, status, matchedCount, errorMessage });
  }

  return NextResponse.json({ ok: true, summary });
}
