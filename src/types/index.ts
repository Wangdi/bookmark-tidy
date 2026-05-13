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

export interface TrialInfo {
  folderName: string;       // e.g., "📁Organized (Trial 25) - 2026-05-14"
  processedCount: number;   // Number of bookmarks in trial
  totalCount: number;       // Total bookmarks available
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
  isTrialMode?: boolean;  // Flag for trial mode
  trialInfo?: TrialInfo;  // Trial-specific information
}

export interface OrganizerState {
  isRunning: boolean;
  shouldAbort: boolean;
  // Current progress info for popup to restore state
  current: number;
  total: number;
  currentUrl?: string;
  isTrialMode?: boolean;  // Flag for trial mode
}

export interface ClusterResult {
  bookmarks: CategorizedBookmark[];
  categoryNames: string[];
}

export interface OrganizationOptions {
  maxBookmarks?: number;  // undefined = all, number = trial mode
}
