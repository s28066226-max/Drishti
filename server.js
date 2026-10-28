import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createApp } from './lib/app.js';
import { hasKey, warmUp } from './lib/gemini.js';

const envFile = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT) || 8080;

createServer(createApp()).listen(PORT, () => {
  console.log(`Drishti running at http://localhost:${PORT}`);
  if (!hasKey()) console.log('No GEMINI_API_KEY found — add it to .env to enable vision.');
  else warmUp().catch((err) => console.warn(`[gemini] warm-up failed: ${err.message}`));
});
