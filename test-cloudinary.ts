import config from './src/core/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

async function run() {
  console.log("Configured Cloudinary.");
  try {
    // We'll just generate a signature to see if it works
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder: 'test' }, config.cloudinary.apiSecret!);
    console.log("Generated Signature:", signature);

    // Let's try to upload a dummy base64 string
    console.log("Attempting upload...");
    const res = await cloudinary.uploader.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", {
      folder: "test",
      resource_type: "auto"
    });
    console.log("Upload Success!", res.secure_url);
  } catch (err: any) {
    console.error("Upload Error:", err);
  }
}

run();
