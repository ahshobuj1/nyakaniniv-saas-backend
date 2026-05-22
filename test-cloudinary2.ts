import fs from 'fs';
import config from './src/core/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

async function run() {
  fs.writeFileSync('dummy.mp3', 'dummy audio content');
  try {
    console.log("Attempting upload of dummy.mp3...");
    const res = await cloudinary.uploader.upload('dummy.mp3', {
      folder: "test",
      resource_type: "auto"
    });
    console.log("Upload Success!", res.secure_url);
  } catch (err: any) {
    console.error("Upload Error:", err?.message || err);
  } finally {
    fs.unlinkSync('dummy.mp3');
  }
}
run();
