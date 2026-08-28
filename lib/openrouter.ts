/**
 * OpenRouter를 통해 일본어 논문 제목/초록을 한국어로 번역.
 * 기본 모델은 google/gemini-2.5-flash-lite (2026년 8월 기준 OpenRouter 최저가 모델 중 하나,
 * 입력 $0.10/1M 토큰, 출력 $0.40/1M 토큰) - 논문 1건당 비용이 1원 미만 수준이라
 * 하루 100~200원 예산 안에서 넉넉하게 처리 가능. 가격은 바뀔 수 있어 필요하면
 * OPENROUTER_MODEL 환경변수로 다른 모델로 바꿀 수 있다.
 */

const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export type TranslationResult = {
  titleKo: string | null;
  abstractKo: string | null;
};

export async function translateToKorean(
  titleJa: string,
  abstractJa: string | null
): Promise<TranslationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되어 있지 않습니다.");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const userContent = [
    "다음 일본어 학술논문 정보를 한국어로 번역해줘.",
    "전문 용어(반도체, 실리콘 단결정 등)는 한국에서 통용되는 학술 용어로 번역해줘.",
    "반드시 아래 JSON 형식으로만 답해줘. 다른 설명은 절대 붙이지 마.",
    '{"title_ko": "번역된 제목", "abstract_ko": "번역된 초록 (초록이 없으면 빈 문자열)"}',
    "",
    `제목(JA): ${titleJa}`,
    `초록(JA): ${abstractJa || "(초록 없음)"}`,
  ].join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: userContent }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter API 오류: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter 응답에 번역 결과가 없습니다.");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      titleKo: typeof parsed.title_ko === "string" ? parsed.title_ko : null,
      abstractKo:
        typeof parsed.abstract_ko === "string" && parsed.abstract_ko.length > 0
          ? parsed.abstract_ko
          : null,
    };
  } catch {
    throw new Error("OpenRouter 응답 JSON 파싱 실패");
  }
}

/**
 * 최근 뉴스 헤드라인 묶음을 바탕으로 회사별 "시사점"(한국어)을 요약 생성한다.
 * 회사당 하루 1회만 호출하도록 호출부에서 제한하므로, 6개사를 매일 갱신해도
 * 비용은 하루 몇 원 수준(모델: google/gemini-2.5-flash-lite)에 그친다.
 */
export async function generateWaferInsight(
  companyNameKo: string,
  headlines: { title: string; summary: string | null; source: string | null; date: string | null }[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되어 있지 않습니다.");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const headlineText = headlines
    .map((h, i) => `${i + 1}. [${h.date ?? "날짜 미상"}/${h.source ?? "출처 미상"}] ${h.title}${h.summary ? ` - ${h.summary}` : ""}`)
    .join("\n");

  const userContent = [
    `아래는 반도체 실리콘 웨이퍼 제조사 "${companyNameKo}" 관련 최근 뉴스 헤드라인 목록이다.`,
    "이 정보를 바탕으로 비개발자·비전문가도 이해할 수 있는 한국어로 간단한 브리핑을 작성해줘.",
    "형식: 3~5개의 짧은 문장(불릿 없이 줄바꿈으로만 구분), 각 문장은 '~함/~임' 개조식이 아니라 자연스러운 서술형으로.",
    "내용 구성: (1) 최근 가장 중요한 동향 1~2가지, (2) 그것이 왜 중요한지/시사점, (3) 앞으로 주목할 점.",
    "뉴스에 없는 내용은 추측해서 쓰지 말고, 확실하지 않으면 '확인 필요'라고 표시해줘.",
    "반드시 아래 JSON 형식으로만 답해줘. 다른 설명은 절대 붙이지 마.",
    '{"insight_ko": "브리핑 내용"}',
    "",
    "뉴스 목록:",
    headlineText,
  ].join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: userContent }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter API 오류: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter 응답에 시사점 결과가 없습니다.");
  }

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.insight_ko !== "string" || !parsed.insight_ko.trim()) {
      throw new Error("insight_ko 필드가 비어있습니다.");
    }
    return parsed.insight_ko.trim();
  } catch {
    throw new Error("OpenRouter 응답 JSON 파싱 실패");
  }
}
