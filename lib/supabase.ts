import { createClient } from "@supabase/supabase-js";

// 이 URL과 anon 키는 비공개 정보가 아니라(공개 페이지에서 늘 노출되는 값) 기본값으로 넣어둔다.
// 다른 Supabase 프로젝트를 쓰고 싶으면 Vercel 환경변수로 덮어쓰면 된다.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fgydssnocwcmjgfsbplt.supabase.co";
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZneWRzc25vY3djbWpnZnNicGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTM1MTYsImV4cCI6MjEwMjgyOTUxNn0.Uge9urg02fpsdeZoguLfUqY5LD9kTPxuf9FkOO1fyWE";

/** 대시보드 화면에서 논문을 읽기 전용으로 조회할 때 사용 (공개 anon 키, RLS로 select만 허용) */
export function getPublicSupabaseClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

/** 매주 자동 수집 작업에서만 사용하는 서버 전용 클라이언트 (service role 키로 RLS 우회, insert/update 가능) */
export function getServiceSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
