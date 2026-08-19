import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { env, onboarding } from '../config.js';

// カテゴリ配下の既存 `所属手続きno{N}` から次の連番を計算
function nextSeq(guild) {
  const category = guild.channels.cache.get(env.ONBOARDING_CATEGORY_ID);
  if (!category) throw new Error('ONBOARDING_CATEGORY_ID not found in guild');
  const children = category.children?.cache ?? guild.channels.cache.filter((c) => c.parentId === category.id);
  let max = 0;
  for (const ch of children.values()) {
    const m = ch.name?.match(/^所属手続きno(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function disableButtons(row, disabledLabel) {
  const rebuilt = new ActionRowBuilder();
  for (const btn of row.components) {
    const b = ButtonBuilder.from(btn).setDisabled(true);
    if (disabledLabel && btn.data.style === ButtonStyle.Success) b.setLabel(disabledLabel);
    rebuilt.addComponents(b);
  }
  return rebuilt;
}

async function createOnboardingChannel(guild, userId, client) {
  const seq = nextSeq(guild);
  const name = `所属手続きno${seq}`;
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: env.ONBOARDING_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        // Bot 自身: @everyone deny の中でも作業できるように明示 allow
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.ManageThreads,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: env.FOUNDER_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: userId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
    ],
  });

  // 定型文投稿 → ピン留め
  const body = [onboarding.body_ja, onboarding.body_en].filter(Boolean).join('\n\n---\n\n');
  const intro = await channel.send({ content: body });
  try { await intro.pin(); } catch (e) { console.warn('pin failed:', e?.message); }

  // スレッド自動作成
  for (const threadName of onboarding.thread_names || []) {
    try {
      await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 10080, // 7 days
        type: ChannelType.PublicThread,
        reason: 'onboarding auto-created thread',
      });
    } catch (e) {
      console.warn(`thread create failed (${threadName}):`, e?.message);
    }
  }

  return channel;
}

export async function handleButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('join:')) return;

  const [, action, userId] = id.split(':');

  // 承認/却下は Founder のみ可能
  if (interaction.user.id !== env.FOUNDER_USER_ID) {
    return interaction.reply({
      content: '承認できるのは Founder のみです。',
      ephemeral: true,
    });
  }

  if (action === 'reject') {
    await interaction.update({
      content: `${interaction.message.content}\n\n**→ 却下**`,
      components: [disableButtons(interaction.message.components[0], '却下済み')],
    });
    return;
  }

  if (action !== 'approve') return;

  // 二重作成防止: まずボタンを disabled にして応答を確定
  await interaction.update({
    content: `${interaction.message.content}\n\n**→ 承認・作成中…**`,
    components: [disableButtons(interaction.message.components[0], '承認済み')],
  });

  const guild = interaction.client.guilds.cache.get(env.GUILD_ID);
  if (!guild) {
    await interaction.followUp({ content: 'GUILD_ID がキャッシュに見つかりません。', ephemeral: true });
    return;
  }

  try {
    const applicant = await guild.members.fetch(userId);
    const channel = await createOnboardingChannel(guild, userId, interaction.client);

    await interaction.followUp({
      content: `✅ プライベートチャンネルを作成しました → <#${channel.id}>`,
      ephemeral: true,
    });

    // 実行者にも通知 (DM ではなく、そのチャンネル内でメンション)
    try {
      await channel.send({ content: `<@${userId}> ようこそ。上のピン留めに沿って進めていきましょう。` });
    } catch (e) { console.warn('welcome mention failed:', e?.message); }
  } catch (err) {
    console.error('channel creation failed:', err);
    await interaction.followUp({
      content: `作成に失敗しました: \`${err?.message ?? err}\``,
      ephemeral: true,
    });
  }
}
