import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Video Game Images Service
 *
 * Handles downloading and caching game images from CDNs (Nintendo, PS5, Xbox, etc.)
 * Images are stored in persistent volume: /app/data/video-game-images/{platform}/
 */

export class VideoGameImagesService {
  private basePath: string;
  private videoGamesImagesPath: string;

  constructor() {
    // Use Railway's persistent volume path or local data/ directory
    this.basePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
    this.videoGamesImagesPath = path.join(this.basePath, 'video-game-images');
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
      }

      if (!fs.existsSync(this.videoGamesImagesPath)) {
        fs.mkdirSync(this.videoGamesImagesPath, { recursive: true });
        console.log(`✅ Created video game images directory: ${this.videoGamesImagesPath}`);
      }
    } catch (error) {
      console.error('Error creating video game images directories:', error);
      throw error;
    }
  }

  /**
   * Ensure platform-specific directory exists
   */
  private ensurePlatformDirectory(platform: string) {
    const platformPath = path.join(this.videoGamesImagesPath, platform);
    if (!fs.existsSync(platformPath)) {
      fs.mkdirSync(platformPath, { recursive: true });
      console.log(`✅ Created platform directory: ${platformPath}`);
    }
    return platformPath;
  }

  /**
   * Get the full path to a video game image file
   */
  getImagePath(titleId: string, platform: string, type: 'landscape' | 'portrait' | 'screenshot'): string {
    const platformPath = this.ensurePlatformDirectory(platform);
    return path.join(platformPath, `${titleId}_${type}.jpg`);
  }

  /**
   * Check if image exists in cache
   */
  imageExists(titleId: string, platform: string, type: 'landscape' | 'portrait' | 'screenshot'): boolean {
    const imagePath = this.getImagePath(titleId, platform, type);
    return fs.existsSync(imagePath);
  }

  /**
   * Download image from Nintendo CDN
   */
  async downloadFromNintendoCDN(nsuid: number, type: 'landscape' | 'portrait' | 'screenshot'): Promise<Buffer> {
    const urls = {
      landscape: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/hero`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_960/ncom/en_US/games/switch/${nsuid}/hero`,
      ],
      portrait: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/box-emart`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_512/ncom/en_US/games/switch/${nsuid}/box-emart`,
      ],
      screenshot: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/screenshot-gallery/screenshot01`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_960/ncom/en_US/games/switch/${nsuid}/screenshot-gallery/screenshot01`,
      ],
    };

    const urlsToTry = urls[type];

    for (let i = 0; i < urlsToTry.length; i++) {
      const url = urlsToTry[i];
      try {
        console.log(`📥 Downloading ${type} image from Nintendo CDN: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`   ⚠️  Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`   ✅ Downloaded ${type} image: ${buffer.length} bytes`);
        return buffer;
      } catch (error) {
        console.warn(`   ⚠️  Error fetching from ${url}:`, error);
        if (i === urlsToTry.length - 1) {
          // Last URL failed, throw error
          throw new Error(`Failed to download ${type} image from Nintendo CDN after ${urlsToTry.length} attempts`);
        }
      }
    }

    throw new Error(`Failed to download ${type} image from Nintendo CDN`);
  }

  /**
   * Cache image to persistent volume
   */
  async cacheImage(
    titleId: string,
    platform: string,
    imageBuffer: Buffer,
    type: 'landscape' | 'portrait' | 'screenshot'
  ): Promise<string> {
    try {
      const imagePath = this.getImagePath(titleId, platform, type);

      // Check if already exists
      if (fs.existsSync(imagePath)) {
        console.log(`📦 Image already cached: ${titleId}_${type}`);
        return imagePath;
      }

      // Write image to disk
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`💾 Saved ${type} image to persistent volume: ${titleId} (${imageBuffer.length} bytes)`);

      return imagePath;
    } catch (error) {
      console.error(`Error caching image ${titleId}_${type}:`, error);
      throw error;
    }
  }

  /**
   * Load image from persistent volume
   */
  async loadImage(titleId: string, platform: string, type: 'landscape' | 'portrait' | 'screenshot'): Promise<Buffer | null> {
    try {
      const imagePath = this.getImagePath(titleId, platform, type);

      if (!fs.existsSync(imagePath)) {
        return null;
      }

      return fs.readFileSync(imagePath);
    } catch (error) {
      console.error(`Error loading image ${titleId}_${type}:`, error);
      return null;
    }
  }

  /**
   * Download and cache image from Nintendo CDN
   */
  async downloadAndCacheNintendoImage(
    titleId: string,
    nsuid: number,
    type: 'landscape' | 'portrait' | 'screenshot'
  ): Promise<string> {
    try {
      // Check if already cached
      if (this.imageExists(titleId, 'switch', type)) {
        console.log(`📦 Image already cached: ${titleId}_${type}`);
        return this.getImagePath(titleId, 'switch', type);
      }

      // Download from CDN
      const imageBuffer = await this.downloadFromNintendoCDN(nsuid, type);

      // Cache to persistent volume
      const imagePath = await this.cacheImage(titleId, 'switch', imageBuffer, type);

      return imagePath;
    } catch (error) {
      console.error(`Error downloading and caching image for ${titleId}:`, error);
      throw error;
    }
  }

  /**
   * Get cached image or download if not cached
   */
  async getOrDownloadImage(
    titleId: string,
    platform: string,
    type: 'landscape' | 'portrait' | 'screenshot',
    nsuid?: number
  ): Promise<Buffer | null> {
    try {
      // Try to load from cache first
      const cachedImage = await this.loadImage(titleId, platform, type);
      if (cachedImage) {
        return cachedImage;
      }

      // If not cached and we have nsuid (for Nintendo), download it
      if (platform === 'switch' && nsuid) {
        await this.downloadAndCacheNintendoImage(titleId, nsuid, type);
        return await this.loadImage(titleId, platform, type);
      }

      return null;
    } catch (error) {
      console.error(`Error getting or downloading image for ${titleId}:`, error);
      return null;
    }
  }

  /**
   * Delete image from cache
   */
  async deleteImage(titleId: string, platform: string, type: 'landscape' | 'portrait' | 'screenshot'): Promise<boolean> {
    try {
      const imagePath = this.getImagePath(titleId, platform, type);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️  Deleted image: ${titleId}_${type}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error deleting image ${titleId}_${type}:`, error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(platform?: string): Promise<{
    totalImages: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    platforms: Record<string, { images: number; sizeBytes: number }>;
  }> {
    try {
      const stats = {
        totalImages: 0,
        totalSizeBytes: 0,
        totalSizeMB: 0,
        platforms: {} as Record<string, { images: number; sizeBytes: number }>,
      };

      const platformDirs = fs.readdirSync(this.videoGamesImagesPath);

      for (const platformDir of platformDirs) {
        if (platform && platformDir !== platform) continue;

        const platformPath = path.join(this.videoGamesImagesPath, platformDir);
        if (!fs.statSync(platformPath).isDirectory()) continue;

        const files = fs.readdirSync(platformPath);
        let platformSize = 0;

        for (const file of files) {
          const filePath = path.join(platformPath, file);
          const fileStats = fs.statSync(filePath);
          platformSize += fileStats.size;
          stats.totalImages++;
        }

        stats.platforms[platformDir] = {
          images: files.length,
          sizeBytes: platformSize,
        };
        stats.totalSizeBytes += platformSize;
      }

      stats.totalSizeMB = Math.round((stats.totalSizeBytes / 1024 / 1024) * 100) / 100;

      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }
}

// Singleton instance
export const videoGameImagesService = new VideoGameImagesService();
