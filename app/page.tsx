import { Cpu, Layers, RefreshCw } from "lucide-react";

import { CompanyInsightCard } from "@/components/company-insight-card";
import { SiteNav } from "@/components/site-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { Article, WaferCompany, WaferInsight, WaferSyncLog } from "@/lib/types";
import { getArticlesForCompany, getWaferCompanies } from "@/lib/wafer";

export const revalidate = 1800; // 30분마다 새로 불러옴

async function getData() {
  const supabase = getPublicSupabaseClient();

  const [companies, insightsRes, syncRes] = await Promise.all([
    getWaferCompanies(supabase),
    supabase
      .from("wafer_insights")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(100),
    supabase
      .from("wafer_sync_log")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(20),
  ]);

  const latestInsightBySlug = new Map<string, WaferInsight>();
  for (const insight of (insightsRes.data ?? []) as WaferInsight[]) {
    if (!latestInsightBySlug.has(insight.company_slug)) {
      latestInsightBySlug.set(insight.company_slug, insight);
    }
  }

  const articlesByCompany = new Map<string, Article[]>();
  await Promise.all(
    companies.map(async (c) => {
      const articles = await getArticlesForCompany(supabase, c, { limit: 6, sinceDays: 30 });
      articlesByCompany.set(c.slug, articles);
    })
  );

  return {
    companies,
    latestInsightBySlug,
    articlesByCompany,
    syncLogs: (syncRes.data ?? []) as WaferSyncLog[],
  };
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return "아직 실행 기록 없음";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function Home() {
  const { companies, latestInsightBySlug, articlesByCompany, syncLogs } = await getData();

  const lastRun = syncLogs[0];
  const hasErrorInLastRun = syncLogs.some(
    (l) => l.run_at === lastRun?.run_at && l.status === "error"
  );
  const totalNewsCount = companies.reduce(
    (sum, c) => sum + (articlesByCompany.get(c.slug)?.length ?? 0),
    0
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-4">
        <SiteNav active="wafer" />
        <div className="flex items-center gap-2">
          <Cpu className="text-primary size-6" />
          <h1 className="text-2xl font-bold tracking-tight">
            반도체 웨이퍼 제조사 동향 대시보드
          </h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {companies.map((c) => c.name_ko).join(", ")}의 최신 뉴스를 Google 뉴스, 일본
          경제신문(닛케이), Yahoo! Japan 등에서 자동으로 모으고, AI가 회사별 핵심 동향과
          시사점을 한국어로 요약해 보여주는 대시보드입니다.
        </p>
      </header>

      {syncLogs.length === 0 && (
        <Alert>
          <RefreshCw />
          <AlertTitle>아직 AI 시사점이 생성되지 않았습니다</AlertTitle>
          <AlertDescription>
            첫 자동 생성이 아직 실행되지 않았습니다. 잠시 후 다시 방문하면 회사별 시사점이
            표시됩니다. (뉴스 자체는 이미 실시간으로 모이고 있습니다.)
          </AlertDescription>
        </Alert>
      )}

      {hasErrorInLastRun && (
        <Alert variant="destructive">
          <AlertTitle>최근 시사점 생성 중 일부 오류가 있었습니다</AlertTitle>
          <AlertDescription>
            {syncLogs.find((l) => l.status === "error")?.error_message ??
              "자세한 내용은 관리자에게 문의해 주세요."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="size-4" />
            수집 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">최근 시사점 생성 시각</p>
              <p className="text-sm font-medium">{formatDateTime(lastRun?.run_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">최근 30일 관련 뉴스</p>
              <p className="text-sm font-medium">{totalNewsCount.toLocaleString()}건</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">업데이트 주기</p>
              <p className="text-sm font-medium">뉴스는 실시간, AI 시사점은 매일 자동 갱신</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Tabs defaultValue="전체">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="전체">
              <Layers />
              전체
            </TabsTrigger>
            {companies.map((c) => (
              <TabsTrigger key={c.slug} value={c.slug}>
                {c.name_ko}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="전체" className="mt-4 flex flex-col gap-4">
          {companies.map((c) => (
            <CompanyBlock
              key={c.slug}
              company={c}
              insight={latestInsightBySlug.get(c.slug) ?? null}
              articles={articlesByCompany.get(c.slug) ?? []}
            />
          ))}
        </TabsContent>
        {companies.map((c) => (
          <TabsContent key={c.slug} value={c.slug} className="mt-4 flex flex-col gap-4">
            <CompanyBlock
              company={c}
              insight={latestInsightBySlug.get(c.slug) ?? null}
              articles={articlesByCompany.get(c.slug) ?? []}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CompanyBlock({
  company,
  insight,
  articles,
}: {
  company: WaferCompany;
  insight: WaferInsight | null;
  articles: Article[];
}) {
  return <CompanyInsightCard company={company} insight={insight} articles={articles} />;
}
