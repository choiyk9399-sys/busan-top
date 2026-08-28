export type Paper = {
  id: string;
  cinii_url: string;
  title_ja: string;
  title_ko: string | null;
  authors: string | null;
  journal: string | null;
  abstract_ja: string | null;
  abstract_ko: string | null;
  published_date: string | null;
  keyword: string;
  translated: boolean;
  fetched_at: string;
  created_at: string;
};

export type SyncLog = {
  id: string;
  run_at: string;
  keyword: string | null;
  fetched_count: number;
  new_count: number;
  translated_count: number;
  status: string;
  error_message: string | null;
};

export type Article = {
  id: string;
  section: string;
  title: string;
  summary_ko: string | null;
  source: string | null;
  url: string;
  published_at: string | null;
  created_at: string;
};

export type WaferCompany = {
  id: string;
  slug: string;
  name_ko: string;
  name_en: string;
  name_local: string | null;
  country: string;
  ticker: string | null;
  homepage_url: string | null;
  description_ko: string | null;
  keywords: string[];
  display_order: number;
  created_at: string;
};

export type WaferInsight = {
  id: string;
  company_slug: string;
  insight_ko: string;
  based_on_count: number;
  model: string | null;
  generated_at: string;
};

export type WaferSyncLog = {
  id: string;
  run_at: string;
  company_slug: string | null;
  matched_count: number;
  status: string;
  error_message: string | null;
};
