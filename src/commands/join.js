import {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { env } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Musikaroid Records への所属申請');

// 既存の所属手続きチャンネルを検出
function findExistingChannel(guild, userId) {
  const category = guild.channels.cache.get(env.ONBOARDING_CATEGORY_ID);
  if (!category) return null;
  const children = category.children?.cache ?? guild.channels.cache.filter((c) => c.parentId === category.id);
  for (const ch of children.values()) {
    if (ch.type !== ChannelType.GuildText) continue;
    if (!/^所属手続きno\d+$/.test(ch.name)) continue;
    // 実行者に閲覧許可があるか確認
    const overwrite = ch.permissionOverwrites?.cache?.get(userId);
    if (overwrite && overwrite.allow?.has('ViewChannel')) return ch;
  }
  return null;
}

export async function execute(interaction) {
  // Discord は interaction に 3 秒で最初の応答を要求する。以降の処理は defer 後に。
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member;

  // 第2層: ロール ガード
  if (member.roles.cache.has(env.FOUNDER_ROLE_ID)) {
    return interaction.editReply({ content: '既に Founder です。/join は不要です。' });
  }
  if (member.roles.cache.has(env.ARTIST_ROLE_ID)) {
    return interaction.editReply({ content: '既に所属済みです。手続きが必要な場合は Founder までご連絡ください。' });
  }

  // 既存チャンネルの重複ガード
  const existing = findExistingChannel(interaction.guild, interaction.user.id);
  if (existing) {
    return interaction.editReply({ content: `既に手続きチャンネルがあります → <#${existing.id}>` });
  }

  // 第3層: Founder 承認制
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`join:approve:${interaction.user.id}`)
      .setLabel('承認')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`join:reject:${interaction.user.id}`)
      .setLabel('却下')
      .setStyle(ButtonStyle.Secondary),
  );

  try {
    const founder = await interaction.client.users.fetch(env.FOUNDER_USER_ID);
    await founder.send({
      content:
        `**${interaction.user.tag}** (\`${interaction.user.id}\`) が \`/join\` を実行しました。\n` +
        'プライベートチャンネルを作成しますか？',
      components: [buttons],
    });
  } catch (err) {
    console.error('failed to DM founder:', err);
    return interaction.editReply({
      content: '一時的なエラーで受付できませんでした。時間をおいて再度お試しください。 (Founder が DM を受け取れる設定か確認してください)',
    });
  }

  return interaction.editReply({ content: '申請を受け付けました。Founder 確認後にご案内します。' });
}
