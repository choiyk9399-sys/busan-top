import type { SupabaseClient } from "@supabase/supabase-js";

import type { Article, WaferCompany } from "@/lib/types";

/**
 * 회사의 keywords 배열로 articles 테이블(title/summary_ko)을 검색하는
 * PostgREST or() 필터 문자열을 만든다.
 * 예: ["SUMCO","섬코"] -> "title.ilike.%SUMCO%,summary_ko.ilike.%SUMCO%,title.ilike.%섬코%,summary_ko.ilike.%섬코%"
 */
function buildKeywordOrFilter(keywords: string[]): string {
  return keywords
    .flatMap((kw) => {
      const escaped = kw.replace(/[%,]/g, "");
      return [`title.ilike.%${escaped}%`, `summary_ko.ilike.%${escaped}%`];
    })
    .join(",");
}

export async function getWaferCompanies(
  supabase: SupabaseClient
): Promise<WaferCompany[]> {
  const { data } = await supabase
    .from("wafer_companies")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []) as WaferCompany[];
}

/** 특정 회사와 관련된 최근 기사를 articles 테이블에서 찾는다 (키워드 제목/요약 매칭). */
export async function getArticlesForCompany(
  supabase: SupabaseClient,
  company: Pick<WaferCompany, "keywords">,
  opts: { limit?: number; sinceDays?: number } = {}
): Promise<Article[]> {
  if (!company.keywords || company.keywords.length === 0) return [];

  const limit = opts.limit ?? 12;
  const sinceDays = opts.sinceDays ?? 30;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("articles")
    .select("*")
    .or(buildKeywordOrFilter(company.keywords))
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Article[];
}
