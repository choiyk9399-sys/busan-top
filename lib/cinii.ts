import { XMLParser } from "fast-xml-parser";

/**
 * CiNii Research(cir.nii.ac.jp)는 일본 학술논문 검색 사이트라
 * 일본어 키워드로 검색해야 정확도가 높다.
 * key: 화면에 보여줄 한국어 라벨, value: 실제 검색에 쓰는 일본어 키워드
 */
export const CINII_KEYWORDS: { label: string; query: string }[] = [
  { label: "반도체", query: "半導体" },
  { label: "실리콘 단결정 성장", query: "シリコン単結晶成長" },
  { label: "실리콘 단결정 웨이퍼 가공", query: "シリコン単結晶ウェハ加工" },
];

export type CiniiRawPaper = {
  ciniiUrl: string;
  titleJa: string;
  authors: string | null;
  journal: string | null;
  abstractJa: string | null;
  publishedDate: string | null; // YYYY-MM-DD
  keyword: string;
};

const CINII_ENDPOINT = "https://cir.nii.ac.jp/opensearch/articles";

/**
 * CiNii Research OpenSearch API를 Atom 포맷으로 호출한다.
 * Atom/RSS 포맷은 appid(신청 ID) 없이도 호출 가능하다고 공식 문서에 안내되어 있다.
 * (JSON-LD/RDF 포맷은 appid가 필요할 수 있어 굳이 쓰지 않는다.)
 */
export async function fetchCiniiPapers(
  keywordQuery: string,
  count = 20
): Promise<{ raw: string; entries: Record<string, unknown>[] }> {
  const url = `${CINII_ENDPOINT}?q=${encodeURIComponent(
    keywordQuery
  )}&count=${count}&sortorder=1&format=atom`;

  const res = await fetch(url, {
    headers: { Accept: "application/atom+xml" },
    // CiNii는 캐시하지 않고 매번 최신 상태를 받는다
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`CiNii API 응답 오류: HTTP ${res.status}`);
  }

  const raw = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(raw);

  const feed = parsed?.feed;
  if (!feed) {
    return { raw, entries: [] };
  }

  const entries = feed.entry
    ? Array.isArray(feed.entry)
      ? feed.entry
      : [feed.entry]
    : [];

  return { raw, entries };
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return (obj["#text"] as string).trim() || null;
  }
  return null;
}

function extractLink(entry: Record<string, unknown>): string | null {
  const link = entry.link;
  if (!link) return toText(entry.id);

  const links = Array.isArray(link) ? link : [link];
  for (const l of links) {
    if (typeof l === "object" && l !== null) {
      const obj = l as Record<string, unknown>;
      const href = obj["@_href"];
      if (typeof href === "string") return href;
    }
  }
  return toText(entry.id);
}

function extractAuthors(entry: Record<string, unknown>): string | null {
  const author = entry.author;
  if (!author) return null;
  const authors = Array.isArray(author) ? author : [author];
  const names = authors
    .map((a) => {
      if (typeof a === "object" && a !== null) {
        const obj = a as Record<string, unknown>;
        return toText(obj.name);
      }
      return toText(a);
    })
    .filter((n): n is string => Boolean(n));
  return names.length ? names.join(", ") : null;
}

function extractDate(entry: Record<string, unknown>): string | null {
  const candidates = [
    entry["prism:publicationDate"],
    entry["dc:date"],
    entry.published,
    entry.updated,
  ];
  for (const c of candidates) {
    const t = toText(c);
    if (t) {
      // "2024-05" 처럼 일자가 없을 수도 있어 YYYY-MM-DD로 보정
      const match = t.match(/^\d{4}(-\d{2})?(-\d{2})?/);
      if (match) {
        const [y, m, d] = [match[0].slice(0, 4), match[0].slice(5, 7), match[0].slice(8, 10)];
        return `${y}-${m || "01"}-${d || "01"}`;
      }
    }
  }
  return null;
}

export function normalizeCiniiEntry(
  entry: Record<string, unknown>,
  keywordLabel: string
): CiniiRawPaper | null {
  const titleJa = toText(entry.title);
  const ciniiUrl = extractLink(entry);
  if (!titleJa || !ciniiUrl) return null;

  return {
    ciniiUrl,
    titleJa,
    authors: extractAuthors(entry),
    journal: toText(entry["prism:publicationName"] ?? entry["dc:source"]) ?? null,
    abstractJa: toText(entry.summary ?? entry["dc:description"]),
    publishedDate: extractDate(entry),
    keyword: keywordLabel,
  };
}
