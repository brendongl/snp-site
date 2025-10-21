import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistent Volume Configuration for Railway
 *
 * Railway persists data in /var/data by default
 * This module handles image storage in the persistent volume
 */

export class PersistentVolume {
  private basePath: string;
  private imagesPath: string;
  private metadataPath: string;

  constructor() {
    // Use Railway's persistent volume path
    // Falls back to local data/ directory for development
    this.basePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
    this.imagesPath = path.join(this.basePath, 'images');
    this.metadataPath = path.join(this.basePath, 'image-metadata.json');

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.basePath)) {
        fs.mkdirSync(this.basePath, { recursive: true });
        console.log(`✅ Created persistent volume directory: ${this.basePath}`);
      }

      if (!fs.existsSync(this.imagesPath)) {
        fs.mkdirSync(this.imagesPath, { recursive: true });
        console.log(`✅ Created images directory: ${this.imagesPath}`);
      }
    } catch (error) {
      console.error('Error creating directories:', error);
      throw error;
    }
  }

  /**
   * Get the path where images are stored
   */
  getImagesDirectory(): string {
    return this.imagesPath;
  }

  /**
   * Get the full path to an image file
   */
  getImagePath(hash: string, extension: string = 'jpg'): string {
    return path.join(this.imagesPath, `${hash}.${extension}`);
  }

  /**
   * Get the metadata file path
   */
  getMetadataPath(): string {
    return this.metadataPath;
  }

  /**
   * Save image bytes to persistent volume
   */
  async saveImage(hash: string, imageBuffer: Buffer, extension: string = 'jpg'): Promise<string> {
    try {
      const imagePath = this.getImagePath(hash, extension);

      // Check if already exists
      if (fs.existsSync(imagePath)) {
        console.log(`📦 Image already cached: ${hash}`);
        return imagePath;
      }

      // Write image to disk
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`💾 Saved image to persistent volume: ${hash} (${imageBuffer.length} bytes)`);

      return imagePath;
    } catch (error) {
      console.error(`Error saving image ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Load image from persistent volume
   */
  async loadImage(hash: string, extension: string = 'jpg'): Promise<Buffer | null> {
    try {
      const imagePath = this.getImagePath(hash, extension);

      if (!fs.existsSync(imagePath)) {
        return null;
      }

      const buffer = fs.readFileSync(imagePath);
      return buffer;
    } catch (error) {
      console.error(`Error loading image ${hash}:`, error);
      return null;
    }
  }

  /**
   * Check if image exists
   */
  imageExists(hash: string, extension: string = 'jpg'): boolean {
    const imagePath = this.getImagePath(hash, extension);
    return fs.existsSync(imagePath);
  }

  /**
   * Get directory size
   */
  getDirectorySize(): number {
    try {
      let size = 0;
      const files = fs.readdirSync(this.imagesPath);

      for (const file of files) {
        const filePath = path.join(this.imagesPath, file);
        const stats = fs.statSync(filePath);
        size += stats.size;
      }

      return size;
    } catch (error) {
      console.error('Error calculating directory size:', error);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  getStatistics(): {
    totalImages: number;
    totalSize: number;
    totalSizeMB: number;
    basePath: string;
  } {
    try {
      const files = fs.readdirSync(this.imagesPath);
      const totalSize = this.getDirectorySize();

      return {
        totalImages: files.length,
        totalSize,
        totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
        basePath: this.basePath,
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        totalImages: 0,
        totalSize: 0,
        totalSizeMB: 0,
        basePath: this.basePath,
      };
    }
  }

  /**
   * Clean up old/unused images
   * (can be called periodically to free up space)
   */
  async cleanupUnusedImages(hashesToKeep: Set<string>): Promise<{ deleted: number; freed: number }> {
    try {
      const files = fs.readdirSync(this.imagesPath);
      let deleted = 0;
      let freed = 0;

      for (const file of files) {
        const hash = file.split('.')[0];

        if (!hashesToKeep.has(hash)) {
          const filePath = path.join(this.imagesPath, file);
          const stats = fs.statSync(filePath);
          fs.unlinkSync(filePath);
          deleted++;
          freed += stats.size;
          console.log(`🗑️  Deleted unused image: ${file}`);
        }
      }

      console.log(`✅ Cleanup complete: ${deleted} files deleted, ${freed / 1024 / 1024} MB freed`);
      return { deleted, freed };
    } catch (error) {
      console.error('Error cleaning up images:', error);
      return { deleted: 0, freed: 0 };
    }
  }

  /**
   * Is running on Railway?
   */
  static isRailway(): boolean {
    return !!process.env.RAILWAY_ENVIRONMENT_NAME;
  }

  /**
   * Get environment info
   */
  static getEnvironmentInfo(): {
    isRailway: boolean;
    railwayEnv: string | undefined;
    volumePath: string | undefined;
  } {
    return {
      isRailway: this.isRailway(),
      railwayEnv: process.env.RAILWAY_ENVIRONMENT_NAME,
      volumePath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
    };
  }
}

// Export singleton instance
export const persistentVolume = new PersistentVolume();
