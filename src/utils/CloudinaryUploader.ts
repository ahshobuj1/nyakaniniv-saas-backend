import { v2 as cloudinary } from 'cloudinary';
import { IFileUploader } from './IFileUploader';
import config from '@/core/config';
import fs from 'fs/promises';

export class CloudinaryUploader implements IFileUploader {
  constructor() {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    // 🔴 1. Add this check to catch the real issue!
    if (!config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      throw new Error(`Cloudinary Config Missing! Key: ${config.cloudinary.apiKey}, Secret: ${config.cloudinary.apiSecret}`);
    }

    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: config.cloudinary.folder,
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
      });

      return result.secure_url;
    } catch (err: any) {
      const message = err?.message || err?.error?.message || JSON.stringify(err);
      throw new Error(`Cloudinary upload failed: ${message}`);
    } finally {
      if (file.path) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkErr) {
          console.error(`Failed to delete temp file: ${file.path}`, unlinkErr);
        }
      }
    }
  }
}