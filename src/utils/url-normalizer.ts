const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'source',
  'fbclid',
  'gclid',
  'msclkid',
];

/**
 * Normalize a URL for deduplication purposes
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // 1. lowercase
    let normalized = parsed.hostname.toLowerCase();

    // 2. remove www.
    normalized = normalized.replace(/^www\./, '');

    // 3. remove protocol (already done by using hostname)

    // 4. add path (remove trailing slash)
    let path = parsed.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    normalized += path;

    // 5. sort query params and remove tracking params
    const params = new URLSearchParams(parsed.search);
    const filteredParams: string[] = [];

    params.forEach((value, key) => {
      if (!TRACKING_PARAMS.includes(key.toLowerCase())) {
        filteredParams.push(`${key}=${value}`);
      }
    });

    if (filteredParams.length > 0) {
      filteredParams.sort();
      normalized += '?' + filteredParams.join('&');
    }

    // 6. add hash if present
    if (parsed.hash) {
      normalized += parsed.hash;
    }

    return normalized;
  } catch {
    // Invalid URL, return as-is
    return url.toLowerCase();
  }
}

/**
 * URL schemes that cannot be fetched via the Fetch API
 */
const UNSUPPORTED_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'about:',
  'edge:',
  'brave:',
  'opera:',
  'vivaldi:',
  'file:',
  'view-source:',
  'javascript:',
  'data:',
  'blob:',
  'filesystem:',
];

/**
 * Check if a URL has a fetchable scheme
 */
export function isFetchableUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  for (const scheme of UNSUPPORTED_SCHEMES) {
    if (lowerUrl.startsWith(scheme)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}
