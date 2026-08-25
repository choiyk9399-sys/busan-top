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
