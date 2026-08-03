const fs = require('fs');
let content = fs.readFileSync('src/utils/EmailTemplates.ts', 'utf8');
content = content.replace(/<h2 style="color: #1f2937; margin-top: 0;">.*?<\/h2>\r?\n\s*/g, '');
content = content.replace(/<p>Please keep this email as proof of your payment\.<\/p>\r?\n\s*/g, '');
fs.writeFileSync('src/utils/EmailTemplates.ts', content);
console.log('done');
