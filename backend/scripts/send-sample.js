// Usage: npm run send-sample [-- path/to/payload.json]
// Sends a payload to the integration endpoint exactly like Google Apps Script does,
// using INTEGRATION_SECRET from .env. Run it twice to see duplicate protection.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.resolve(here, '../../google-apps-script/sample-payload.json');
const url = `http://localhost:${process.env.PORT || 5000}/api/integrations/google-form/submissions`;

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Integration-Secret': process.env.INTEGRATION_SECRET ?? '' },
  body: fs.readFileSync(file, 'utf8'),
});
console.log(`HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
