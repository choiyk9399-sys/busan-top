import type { Metadata } from "next";
import { Cpu, FlaskConical, RefreshCw } from "lucide-react";

import { PaperCard } from "@/components/paper-card";
import { SiteNav } from "@/components/site-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CINII_KEYWORDS } from "@/lib/cinii";
import { getPublicSupabaseClient } from "@/lib/supabase";
import type { Paper, SyncLog } from "@/lib/types";

export const revalidate = 3600; // 1시간마다 새로 불러옴 (어차피 데이터는 주 1회 갱신)

export const metadata: Metadata = {
  title: "실리콘 반도체 논문 대시보드",
  description: "CiNii Research에서 반도체·실리콘 단결정 관련 논문을 매주 수집해 한국어로 보여주는 대시보드",
};

async function getData() {
  const supabase = getPublicSupabaseClient();

  const [papersRes, syncRes] = await Promise.all([
    supabase
      .from("cinii_papers")
      .select("*")
      .order("published_date", { ascending: false, nullsFirst: false })
      .limit(300),
    supabase
      .from("cinii_sync_log")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(10),
  ]);

  return {
    papers: (papersRes.data ?? []) as Paper[],
    syncLogs: (syncRes.data ?? []) as SyncLog[],
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

export default async function PapersPage() {
  const { papers, syncLogs } = await getData();

  const lastRun = syncLogs[0];
  const hasErrorInLastRun = syncLogs.some(
    (l) => l.run_at === lastRun?.run_at && l.status === "error"
  );
  const newestFetchAt = papers[0]?.fetched_at;
  const totalCount = papers.length;

  const byKeyword = (label: string) => papers.filter((p) => p.keyword === label);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-4">
        <SiteNav active="papers" />
        <div className="flex items-center gap-2">
          <Cpu className="text-primary size-6" />
          <h1 className="text-2xl font-bold tracking-tight">
            실리콘 반도체 논문 대시보드
          </h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          일본 학술논문 검색 서비스{" "}
          <a
            href="https://cir.nii.ac.jp"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            CiNii Research
          </a>
          에서 {CINII_KEYWORDS.map((k) => k.label).join(", ")} 관련 논문을 매주 자동으로
          모아 한국어로 번역해 보여줍니다.
        </p>
      </header>

      {syncLogs.length === 0 && (
        <Alert>
          <RefreshCw />
          <AlertTitle>아직 수집된 데이터가 없습니다</AlertTitle>
          <AlertDescription>
            첫 자동 수집이 아직 실행되지 않았습니다. 환경변수 설정을 마치고 수집을 한 번
            실행하면 이곳에 논문이 표시됩니다.
          </AlertDescription>
        </Alert>
      )}

      {hasErrorInLastRun && (
        <Alert variant="destructive">
          <AlertTitle>최근 수집 중 일부 오류가 있었습니다</AlertTitle>
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
              <p className="text-muted-foreground text-xs">마지막 업데이트</p>
              <p className="text-sm font-medium">{formatDateTime(newestFetchAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">전체 논문 수</p>
              <p className="text-sm font-medium">{totalCount.toLocaleString()}건</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">업데이트 주기</p>
              <p className="text-sm font-medium">매주 1회 자동 수집</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Tabs defaultValue="전체">
        <TabsList>
          <TabsTrigger value="전체">전체 ({totalCount})</TabsTrigger>
          {CINII_KEYWORDS.map((k) => (
            <TabsTrigger key={k.label} value={k.label}>
              {k.label} ({byKeyword(k.label).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="전체" className="mt-4 flex flex-col gap-4">
          <PaperList papers={papers} />
        </TabsContent>
        {CINII_KEYWORDS.map((k) => (
          <TabsContent key={k.label} value={k.label} className="mt-4 flex flex-col gap-4">
            <PaperList papers={byKeyword(k.label)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PaperList({ papers }: { papers: Paper[] }) {
  if (papers.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-sm">
        <FlaskConical className="size-6" />
        아직 이 분류에 해당하는 논문이 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {papers.map((p) => (
        <PaperCard key={p.id} paper={p} />
      ))}
    </div>
  );
}
