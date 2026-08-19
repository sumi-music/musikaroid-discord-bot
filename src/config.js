import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '..', 'config', 'onboarding.json');

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} is required`);
  return v;
}

export const env = {
  DISCORD_TOKEN: required('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
  GUILD_ID: required('GUILD_ID'),
  FOUNDER_ROLE_ID: required('FOUNDER_ROLE_ID'),
  ARTIST_ROLE_ID: required('ARTIST_ROLE_ID'),
  FOUNDER_USER_ID: required('FOUNDER_USER_ID'),
  ONBOARDING_CATEGORY_ID: required('ONBOARDING_CATEGORY_ID'),
};

export const onboarding = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
