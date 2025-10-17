import { hashUrl } from './image-cache';

/**
 * Transform image URL to use cached version
 * This is the client-side version that generates the /api/images/[hash] URL
 */
export function useCachedImageUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return undefined;

  // For client-side, we always try to use the cached version
  // The API route will handle fallback if not cached
  const urlHash = hashUrl(originalUrl);
  return `/api/images/${urlHash}`;
}
