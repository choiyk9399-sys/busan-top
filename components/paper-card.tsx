"use client";

import { useState } from "react";
import { ExternalLink, Languages } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Paper } from "@/lib/types";

function formatDate(d: string | null) {
  if (!d) return "게재일 확인 필요";
  return d;
}

export function PaperCard({ paper }: { paper: Paper }) {
  const [showOriginal, setShowOriginal] = useState(!paper.translated);

  const title = !showOriginal && paper.title_ko ? paper.title_ko : paper.title_ja;
  const abstract = !showOriginal && paper.abstract_ko ? paper.abstract_ko : paper.abstract_ja;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{paper.keyword}</Badge>
          <span className="text-muted-foreground text-xs">{formatDate(paper.published_date)}</span>
          {!paper.translated && (
            <Badge variant="outline" className="text-muted-foreground">
              번역 준비 중
            </Badge>
          )}
        </div>
        <CardTitle className="text-base leading-snug font-semibold">{title}</CardTitle>
        {paper.authors && (
          <p className="text-muted-foreground text-xs">{paper.authors}</p>
        )}
        {paper.journal && (
          <p className="text-muted-foreground text-xs italic">{paper.journal}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {abstract ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{abstract}</p>
        ) : (
          <p className="text-muted-foreground text-sm">초록 정보가 없습니다.</p>
        )}
        <div className="flex items-center gap-2">
          {paper.translated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOriginal((v) => !v)}
            >
              <Languages />
              {showOriginal ? "한국어로 보기" : "원문(일본어)으로 보기"}
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <a href={paper.cinii_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              CiNii에서 원문 보기
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
