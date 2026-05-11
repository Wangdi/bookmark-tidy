export interface RawBookmark {
  id: string;
  url: string;
  title: string;
  parentId?: string;
}

export interface BookmarkMeta {
  description?: string;
  ogTitle?: string;
  keywords?: string[];
}

export interface ProcessedBookmark extends RawBookmark {
  meta: BookmarkMeta;
  headings: string[];
  status: 'ok' | 'deadlink' | 'unreachable';
  error?: string;
}

export interface CategorizedBookmark extends ProcessedBookmark {
  category: string;
  subCategory?: string;
}

export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  current: number;
  total: number;
  currentUrl?: string;
  stats?: {
    processed: number;
    duplicatesMerged: number;
    deadlinks: number;
    unreachable: number;
    categories: number;
  };
  error?: string;
}

export interface OrganizerState {
  isRunning: boolean;
  shouldAbort: boolean;
}

export interface ClusterResult {
  bookmarks: CategorizedBookmark[];
  categoryNames: string[];
}
