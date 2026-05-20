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
    this.client = new S3Client({
      region: config.s3.region!,
      credentials: {
        accessKeyId: config.s3.accessKeyId!,
        secretAccessKey: config.s3.secretAccessKey!,
      },
    });
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const body = await readFile(file.path);
    const key = `${config.s3.folder ?? ''}${uuidv4()}${extname(file.originalname)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: body,
        ACL: 'public-read',
        ContentType: file.mimetype,
      })
    );

    // Construct a public URL – this works for most S3 public‑read buckets.
    return `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
  }
}
