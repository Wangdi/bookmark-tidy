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
  detailedMetrics?: DetailedMetrics;  // Detailed performance metrics
  categories?: EditedCategory[];  // Category structure for editor
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

export interface NotificationOptions {
  enabled?: boolean;  // default: true
}

export interface NotificationPayload {
  type: 'success' | 'error' | 'cancelled';
  title: string;
  message: string;
  stats?: {
    processed: number;
    categories: number;
    deadlinks: number;
    duplicatesMerged: number;
    unreachable: number;
  };
  error?: string;
}

export interface UserPreferences {
  autoNavigate?: boolean;  // undefined or true = enabled, false = disabled
}

export interface OrganizedFolderInfo {
  id: string;
  title: string;
  isTrial?: boolean;
}

export interface FetchMetrics {
  totalUrls: number;
  successful: number;
  failed: number;
  timedOut: number;
  averageTime: number;  // ms per URL
  totalTime: number;    // total fetch time in ms
}

export interface StorageMetrics {
  indexedDbWrites: number;
  indexedDbReads: number;
  checkpointSaves: number;
  estimatedSize: number;  // bytes
}

export interface CategorizationMetrics {
  vocabularySize: number;
  vectorDimensions: number;
  clusters: number;
  iterations: number;
  convergenceTime: number;  // ms
}

export interface OrganizationMetrics {
  foldersCreated: number;
  bookmarksCreated: number;
  batches: number;
  averageBatchTime: number;  // ms per batch
}

export interface PerformanceMetrics {
  totalElapsed: number;  // ms
  averagePerBookmark: number;  // ms per bookmark
  memoryEstimate: number;  // bytes
}

export interface DetailedMetrics {
  fetch?: FetchMetrics;
  storage?: StorageMetrics;
  categorization?: CategorizationMetrics;
  organization?: OrganizationMetrics;
  performance?: PerformanceMetrics;
}

export interface EditedCategory {
  id: string;
  name: string;
  bookmarkIds: string[];
}

export type CategoryEditAction =
  | { type: 'rename'; categoryId: string; newName: string }
  | { type: 'merge'; sourceCategoryId: string; targetCategoryId: string }
  | { type: 'delete'; categoryId: string };
