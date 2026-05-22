import { IFileUploader } from '../utils/IFileUploader';
import { CloudinaryUploader } from '../utils/CloudinaryUploader';
import { S3Uploader } from '../utils/S3Uploader';
import config from '../core/config';
import { InfrastructureProvider } from '../core/InfrastructureProvider';

/**
 * Provider that selects the concrete uploader implementation at runtime.
 *
 *   FILE_UPLOADER=cloudinary  -> CloudinaryUploader (default)
 *   FILE_UPLOADER=s3         -> S3Uploader
 */
export class FileUploaderProvider implements InfrastructureProvider<IFileUploader> {
  public name = 'FileUploader';
  private impl!: IFileUploader;

  public async connect(): Promise<void> {
    if (config.fileUploader === 's3') {
      this.impl = new S3Uploader();
    } else {
      this.impl = new CloudinaryUploader();
    }
  }

  public getClient(): IFileUploader {
    return this.impl;
  }

  public async disconnect(): Promise<void> {
    // No explicit disconnection needed for these SDKs in this context
  }
}
