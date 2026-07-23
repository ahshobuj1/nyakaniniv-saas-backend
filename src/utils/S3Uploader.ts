import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IFileUploader } from '@/utils/IFileUploader';
import config from '@/core/config';

/**
 * AWS S3 implementation of the {@link IFileUploader} contract.
 *
 * It reads the uploaded file from the temporary Multer location, then uploads
 * the file to the bucket configured in {@link config.s3}. The object key is a
 * UUID (to avoid collisions) with the original file extension preserved.
 * The method returns the public HTTPS URL of the uploaded object.
 */
export class S3Uploader implements IFileUploader {
  private readonly client: S3Client;

  constructor() {
    // Ensure required S3 configuration is present
    if (!config.s3.region || !config.s3.accessKeyId || !config.s3.secretAccessKey) {
      throw new Error('Missing required S3 configuration (region, accessKeyId, secretAccessKey)');
    }
    const s3Config: any = {
      region: config.s3.region || 'us-east-1',
      credentials: {
        accessKeyId: config.s3.accessKeyId!,
        secretAccessKey: config.s3.secretAccessKey!,
      },
    };

    if (config.s3.endpoint) {
      s3Config.endpoint = config.s3.endpoint;
      s3Config.forcePathStyle = true; // Required for MinIO
    }

    this.client = new S3Client(s3Config);
  }

  async upload(file: Express.Multer.File): Promise<string> {
    try {
      const body = await readFile(file.path);
      const key = `${config.s3.folder ?? ''}${uuidv4()}${extname(file.originalname)}`;

      await this.client.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: body,
          ContentType: file.mimetype,
        })
      );

      // Construct a public URL
      if (config.s3.endpoint) {
        const endpoint = config.s3.endpoint.replace(/\/$/, '');
        return `${endpoint}/${config.s3.bucket}/${key}`;
      }
      return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
    } catch (err: any) {
      console.error('FULL S3 ERROR:', err);
      throw new Error(`S3 upload failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      if (file.path) {
        try {
          await require('fs/promises').unlink(file.path);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }
}
