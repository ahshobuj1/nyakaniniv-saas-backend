import { v2 as cloudinary } from 'cloudinary';
import { IFileUploader } from './IFileUploader';
import config from '@/core/config';

export class CloudinaryUploader implements IFileUploader {
  constructor() {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: config.cloudinary.folder,
      });
      return result.secure_url;
    } catch (err: any) {
      // Cloudinary SDK throws plain objects, not Error instances.
      // Convert to a real Error so the global error handler can process it.
      const message = err?.message || err?.error?.message || JSON.stringify(err);
      throw new Error(`Cloudinary upload failed: ${message}`);
    }
  }
}
