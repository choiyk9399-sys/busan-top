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
