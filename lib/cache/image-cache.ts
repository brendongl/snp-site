import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');
const CACHE_METADATA_FILE = path.join(process.cwd(), 'data', 'image-cache-metadata.json');

interface ImageMetadata {
  originalUrl: string;
  cachedPath: string;
  fileName: string;
  mimeType: string;
  size: number;
  cachedAt: string;
}

interface CacheMetadataStore {
  [urlHash: string]: ImageMetadata;
}

// Ensure cache directory exists
function ensureImageCacheDir() {
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    try {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating image cache directory:', error);
    }
  }
}

// Load metadata
function loadMetadata(): CacheMetadataStore {
  try {
    if (!fs.existsSync(CACHE_METADATA_FILE)) {
      return {};
    }
    const data = fs.readFileSync(CACHE_METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading image cache metadata:', error);
    return {};
  }
}

// Save metadata
function saveMetadata(metadata: CacheMetadataStore) {
  try {
    ensureImageCacheDir();
    fs.writeFileSync(CACHE_METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving image cache metadata:', error);
  }
}

// Generate hash for URL
function hashUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Get file extension from URL or content type
function getFileExtension(url: string, contentType?: string): string {
  // Try to get extension from URL
  const urlExt = path.extname(new URL(url).pathname);
  if (urlExt) {
    return urlExt;
  }

  // Fallback to content type
  if (contentType) {
    const typeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    return typeMap[contentType] || '.jpg';
  }

  return '.jpg';
}

/**
 * Download and cache an image from a URL
 */
export async function cacheImage(url: string): Promise<ImageMetadata | null> {
  try {
    ensureImageCacheDir();

    const urlHash = hashUrl(url);
    const metadata = loadMetadata();

    // Check if already cached
    if (metadata[urlHash]) {
      const cachedPath = path.join(IMAGE_CACHE_DIR, metadata[urlHash].fileName);
      if (fs.existsSync(cachedPath)) {
        return metadata[urlHash];
      }
    }

    // Download image
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download image: ${url} - ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = getFileExtension(url, contentType);
    const fileName = `${urlHash}${extension}`;
    const cachedPath = path.join(IMAGE_CACHE_DIR, fileName);

    // Save image
    fs.writeFileSync(cachedPath, Buffer.from(buffer));

    // Save metadata
    const imageMetadata: ImageMetadata = {
      originalUrl: url,
      cachedPath,
      fileName,
      mimeType: contentType,
      size: buffer.byteLength,
      cachedAt: new Date().toISOString(),
    };

    metadata[urlHash] = imageMetadata;
    saveMetadata(metadata);

    console.log(`Cached image: ${url} -> ${fileName}`);
    return imageMetadata;
  } catch (error) {
    console.error(`Error caching image ${url}:`, error);
    return null;
  }
}

/**
 * Get cached image metadata by URL
 */
export function getCachedImage(url: string): ImageMetadata | null {
  try {
    const urlHash = hashUrl(url);
    const metadata = loadMetadata();
    const cached = metadata[urlHash];

    if (cached) {
      const cachedPath = path.join(IMAGE_CACHE_DIR, cached.fileName);
      if (fs.existsSync(cachedPath)) {
        return cached;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting cached image ${url}:`, error);
    return null;
  }
}

/**
 * Get cached image file path by URL hash
 */
export function getCachedImagePath(urlHash: string): string | null {
  try {
    const metadata = loadMetadata();
    const cached = metadata[urlHash];

    if (cached) {
      const cachedPath = path.join(IMAGE_CACHE_DIR, cached.fileName);
      if (fs.existsSync(cachedPath)) {
        return cachedPath;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting cached image path for hash ${urlHash}:`, error);
    return null;
  }
}

/**
 * Transform image URL to use cached version
 * Returns /api/images/[hash] URL if cached, otherwise original URL
 */
export function getImageUrl(originalUrl: string | undefined): string | undefined {
  if (!originalUrl) return undefined;

  const urlHash = hashUrl(originalUrl);
  const cached = getCachedImage(originalUrl);

  if (cached) {
    return `/api/images/${urlHash}`;
  }

  return originalUrl;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    const metadata = loadMetadata();
    const entries = Object.values(metadata);
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

    return {
      totalImages: entries.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      oldestCache: entries.length > 0 ? entries.reduce((oldest, entry) =>
        new Date(entry.cachedAt) < new Date(oldest.cachedAt) ? entry : oldest
      ).cachedAt : null,
      newestCache: entries.length > 0 ? entries.reduce((newest, entry) =>
        new Date(entry.cachedAt) > new Date(newest.cachedAt) ? entry : newest
      ).cachedAt : null,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      totalImages: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      oldestCache: null,
      newestCache: null,
    };
  }
}

/**
 * Clear all cached images
 */
export function clearImageCache(): boolean {
  try {
    const metadata = loadMetadata();

    // Delete all image files
    for (const entry of Object.values(metadata)) {
      const cachedPath = path.join(IMAGE_CACHE_DIR, entry.fileName);
      if (fs.existsSync(cachedPath)) {
        fs.unlinkSync(cachedPath);
      }
    }

    // Clear metadata
    saveMetadata({});

    console.log('Image cache cleared');
    return true;
  } catch (error) {
    console.error('Error clearing image cache:', error);
    return false;
  }
}

export { hashUrl };
