// Common English stop words to filter out during tokenization
export const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',

  // Conjunctions
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',

  // Prepositions
  'at', 'by', 'from', 'in', 'into', 'of', 'on', 'to', 'with', 'without',
  'about', 'above', 'after', 'against', 'along', 'among', 'around', 'before',
  'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during',
  'except', 'inside', 'outside', 'over', 'since', 'through', 'throughout',
  'till', 'under', 'until', 'upon', 'within',

  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',

  // Auxiliary verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',

  // Other common words
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'also', 'now', 'here', 'there', 'when', 'where', 'why', 'how',
  'then', 'once', 'if', 'because', 'as', 'until', 'while',
  'out', 'up', 'down', 'off', 'over', 'under', 'again', 'further',

  // Common web/navigation words that don't help categorization
  'home', 'page', 'site', 'website', 'web', 'link', 'click', 'here',
  'read', 'more', 'view', 'see', 'find', 'search', 'new', 'old',
  'copyright', 'privacy', 'policy', 'terms', 'contact', 'about',
  'login', 'sign', 'register', 'subscribe', 'follow', 'share',
]);
