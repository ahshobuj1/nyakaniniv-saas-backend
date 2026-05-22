export interface IFileUploader {
  /**
   * Upload a file (received via Multer) and return the public URL of the stored file.
   */
  upload(file: Express.Multer.File): Promise<string>;
}
