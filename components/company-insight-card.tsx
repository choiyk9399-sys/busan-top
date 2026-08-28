import { ExternalLink, Lightbulb, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Article, WaferCompany, WaferInsight } from "@/lib/types";

function formatDate(iso: string | null) {
  if (!iso) return "날짜 미상";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CompanyInsightCard({
  company,
  insight,
  articles,
}: {
  company: WaferCompany;
  insight: WaferInsight | null;
  articles: Article[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{company.name_ko}</CardTitle>
            <span className="text-muted-foreground text-sm">
              {company.name_en}
              {company.name_local && company.name_local !== company.name_en
                ? ` · ${company.name_local}`
                : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{company.country}</Badge>
            {company.ticker && <Badge variant="secondary">{company.ticker}</Badge>}
            {company.homepage_url && (
              <a
                href={company.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center"
                aria-label={`${company.name_ko} 홈페이지`}
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </div>
        {company.description_ko && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {company.description_ko}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-muted/50 rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="text-primary size-4" />
            <span className="text-sm font-semibold">AI 시사점 요약</span>
            {insight && (
              <span className="text-muted-foreground ml-auto text-xs">
                {formatDate(insight.generated_at)} 기준 · 뉴스 {insight.based_on_count}건 분석
              </span>
            )}
          </div>
          {insight ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{insight.insight_ko}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              아직 AI 시사점이 생성되지 않았습니다. 관련 뉴스가 쌓이면 자동으로 생성됩니다.
            </p>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="text-muted-foreground size-4" />
            <span className="text-sm font-semibold">관련 최근 뉴스</span>
          </div>
          {articles.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              최근 30일 이내 수집된 관련 뉴스가 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {articles.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm leading-snug font-medium underline-offset-2 hover:underline"
                  >
                    {a.title}
                  </a>
                  {a.summary_ko && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {a.summary_ko}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {a.source ?? "출처 미상"} · {formatDate(a.published_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
