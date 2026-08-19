// Register slash commands to the target guild.
// Usage: node scripts/register-commands.js
// Requires DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID env vars.
import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import * as joinCmd from '../src/commands/join.js';

const commands = [joinCmd.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log(`registering ${commands.length} command(s) to guild ${process.env.GUILD_ID}...`);
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
    { body: commands },
  );
  console.log('done.');
} catch (err) {
  console.error(err);
  process.exit(1);
}
