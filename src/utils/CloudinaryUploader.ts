import { v2 as cloudinary } from 'cloudinary';
import { IFileUploader } from './IFileUploader';
import fs from 'fs/promises';
import { config } from '../core/config';

export class CloudinaryUploader implements IFileUploader {
  constructor() {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const folder = config.cloudinary.folder || 'uploads';

    try {
      // We use unsigned_upload here so it will always use your upbeat-africa preset reliably
      const result = await cloudinary.uploader.unsigned_upload(file.path, 'upbeat-africa', {
        folder,
        resource_type: 'auto',
        cloud_name: config.cloudinary.cloudName,
      });


      return result.secure_url;
    } catch (err: any) {
      console.error('FULL CLOUDINARY ERROR:', err);

      throw new Error(
        `Cloudinary upload failed: ${err?.message ||
        err?.error?.message ||
        JSON.stringify(err)
        }`
      );
    } finally {
      try {
        await fs.unlink(file.path);
      } catch { }
    }
  }
}