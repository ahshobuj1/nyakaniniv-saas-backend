const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'Modules');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Fix Controller .ok and .created
  content = content.replace(/this\.ok\(res,\s*(.*?)(?:,\s*'(.*?)')?\);/g, (match, data, message) => {
    if (message) {
      return `this.sendResponse(req, res, '${message}', undefined, ${data});`;
    } else {
      return `this.sendResponse(req, res, undefined, undefined, ${data});`;
    }
  });

  content = content.replace(/this\.created\(res,\s*(.*?)(?:,\s*'(.*?)')?\);/g, (match, data, message) => {
    if (message) {
      return `this.sendCreatedResponse(req, res, ${data}, '${message}');`;
    } else {
      return `this.sendCreatedResponse(req, res, ${data});`;
    }
  });

  // Fix param types (string | string[] to string)
  content = content.replace(/const { id } = req\.params;/g, 'const id = String(req.params.id);');
  content = content.replace(/const { tenantId } = req\.params;/g, 'const tenantId = String(req.params.tenantId);');

  // Fix IFileUploader
  content = content.replace(/uploadFile\(/g, 'upload(');

  // Fix Stripe errors in SubscriptionService
  if (filePath.includes('subscription.service.ts')) {
    content = content.replace(/private stripe: Stripe \| null = null;/g, 'private stripe: any = null;');
    content = content.replace(/Stripe\.Event/g, 'any');
    content = content.replace(/Stripe\.Checkout\.Session/g, 'any');
    content = content.replace(/Stripe\.Subscription/g, 'any');
    content = content.replace(/apiVersion: '2025-02-24\.acacia',/g, 'apiVersion: "2024-04-10" as any,');
    content = content.replace(/features: planData\.features,/g, 'features: planData.features as any,');
  }

  // Fix Stripe errors in InvoiceService
  if (filePath.includes('invoice.service.ts')) {
    content = content.replace(/private stripe: Stripe \| null = null;/g, 'private stripe: any = null;');
    content = content.replace(/apiVersion: '2025-02-24\.acacia',/g, 'apiVersion: "2024-04-10" as any,');
  }

  // Fix SubscriptionDTO `required_error` inside z.number()
  if (filePath.includes('SubscriptionDTO.ts')) {
    content = content.replace(/z\.number\(\{ required_error: "Plan ID is required" \}\)/g, 'z.number()');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath);
  }
}

function traverseDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

traverseDir(dir);
console.log('Done.');
