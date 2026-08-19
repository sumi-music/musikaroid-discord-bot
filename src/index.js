import http from 'node:http';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { env } from './config.js';
import * as joinCmd from './commands/join.js';
import { handleButton } from './handlers/approval.js';

// Fly.io の proxy が「HTTP アクセス無し = 遊休」と判定して machine を auto-stop
// してしまうため、health-check 用の最小 HTTP サーバーを併走させる。
const PORT = Number(process.env.PORT || 8080);
http.createServer((_, res) => { res.writeHead(200); res.end('ok'); }).listen(PORT, () => {
  console.log(`health server listening on :${PORT}`);
});

// GuildMembers は Privileged Intent なので外す。/join は interaction.member (payload) と
// guild.members.fetch() (REST) で動作するので Guilds のみで十分。
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, (c) => {
  console.log(`ready as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'join') return joinCmd.execute(interaction);
    }
    if (interaction.isButton()) {
      return handleButton(interaction);
    }
  } catch (err) {
    console.error('interaction handler error:', err);
    if (interaction.isRepliable() && !interaction.replied) {
      try { await interaction.reply({ content: '内部エラーが発生しました。', ephemeral: true }); } catch {}
    }
  }
});

client.login(env.DISCORD_TOKEN);
