#!/usr/bin/env node
// Copies variables from .env.local into the linked Vercel project (production + preview).
// Values are piped through stdin and never printed. Usage:
//   node scripts/set-vercel-env.mjs            # uses .env.local
//   node scripts/set-vercel-env.mjs --check    # only validates the file, changes nothing
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const file = args.find((a) => !a.startsWith('--')) || '.env.local';

const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'ALLOWED_EMAIL'];
const OPTIONAL = ['VITE_PLAN_START', 'VITE_EXAM_DATE', 'GRADER_API_KEY', 'GRADER_PROVIDER', 'GRADER_MODEL', 'GRADER_BASE_URL'];
const PLACEHOLDER = /^(YOUR-|REUSE-|you@example\.com$|https:\/\/YOUR-)/;

if (!existsSync(file)) {
  console.error(`✗ ${file} not found. Copy .env.example to ${file} and fill in the values.`);
  process.exit(1);
}

const vars = {};
for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 1) continue;
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  vars[key] = val;
}

const problems = [];
for (const k of REQUIRED) {
  if (!vars[k]) problems.push(`${k} is missing`);
  else if (PLACEHOLDER.test(vars[k])) problems.push(`${k} still has the example value`);
}
if (vars.VITE_SUPABASE_URL && vars.SUPABASE_URL && vars.VITE_SUPABASE_URL !== vars.SUPABASE_URL) problems.push('VITE_SUPABASE_URL and SUPABASE_URL should be the same');
if (vars.VITE_SUPABASE_ANON_KEY && vars.SUPABASE_ANON_KEY && vars.VITE_SUPABASE_ANON_KEY !== vars.SUPABASE_ANON_KEY) problems.push('VITE_SUPABASE_ANON_KEY and SUPABASE_ANON_KEY should be the same');
if (vars.AZURE_SPEECH_REGION && !/^[a-z0-9]+$/.test(vars.AZURE_SPEECH_REGION)) problems.push('AZURE_SPEECH_REGION should look like "canadacentral" or "eastus"');
if (problems.length) {
  console.error('✗ ' + file + ' needs fixing:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

const keys = [...REQUIRED, ...OPTIONAL.filter((k) => vars[k])];
console.log(`✓ ${file} looks complete: ${keys.join(', ')}`);
if (checkOnly) process.exit(0);

for (const key of keys) {
  for (const target of ['production', 'preview']) {
    spawnSync('npx', ['vercel', 'env', 'rm', key, target, '--yes'], { stdio: 'ignore', shell: true });
    // VITE_ values ship to the browser by design, so the CLI needs an explicit --type config for them.
    const type = key.startsWith('VITE_') ? ['--type', 'config'] : [];
    const r = spawnSync('npx', ['vercel', 'env', 'add', key, '--environment', target, ...type, '--yes'], { input: vars[key], stdio: ['pipe', 'ignore', 'pipe'], shell: true });
    if (r.status !== 0) {
      console.error(`✗ Could not set ${key} (${target}). Is the folder linked? Run: npx vercel link`);
      console.error(String(r.stderr || '').split('\n').filter((l) => !l.includes(vars[key])).slice(-3).join('\n'));
      process.exit(1);
    }
  }
  console.log(`  set ${key} (production, preview)`);
}
console.log('✓ All variables set. Next: npx vercel --prod');
