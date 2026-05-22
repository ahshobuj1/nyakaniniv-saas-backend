import config from './src/core/config';
console.log("API Key:", config.cloudinary.apiKey);
console.log("API Secret:", config.cloudinary.apiSecret);
console.log("Is Secret defined?", config.cloudinary.apiSecret !== undefined);
console.log("Is Secret string 'undefined'?", config.cloudinary.apiSecret === "undefined");
