// Join alerts: The Purge DMs chosen staff every time someone joins a server.
// module_settings, module 'joinalerts': { userIds: [discord user ids] }
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const MODULE = 'joinalerts';
const DAY_MS = 86_400_000;

export async function loadRecipients(db, guildId) {
  const result = await db.query(
    'SELECT config FROM module_settings WHERE guild_id = $1 AND module_name = $2 AND enabled = TRUE',
    [guildId, MODULE],
  );
  const ids = result.rows[0]?.config?.userIds;
  return Array.isArray(ids) ? ids.filter((id) => /^\d{5,25}$/.test(String(id))) : [];
}

export async function saveRecipients(db, guildId, userIds) {
  await db.query(
    `
    INSERT INTO module_settings (guild_id, module_name, enabled, config, updated_at)
    VALUES ($1, $2, TRUE, $3, NOW())
    ON CONFLICT (guild_id, module_name) DO UPDATE SET enabled = TRUE, config = EXCLUDED.config, updated_at = NOW();
    `,
    [guildId, MODULE, JSON.stringify({ userIds: [...new Set(userIds)] })],
  );
}

/** The DM text for one join (pure; tested). */
export function joinAlertEmbed({ guildName, memberCount, userId, username, createdTimestamp, inviteCode, inviteRoleName, verification }, now = Date.now()) {
  const ageDays = Math.floor((now - Number(createdTimestamp || now)) / DAY_MS);
  const lines = [
    `<@${userId}> (**${username}**) joined **${guildName}**.`,
    `Account age: **${ageDays} day${ageDays === 1 ? '' : 's'}**${ageDays < 7 ? ' ⚠️ new account' : ''}`,
    inviteCode ? `Invite: \`${inviteCode}\`${inviteRoleName ? ` (${inviteRoleName})` : ''}` : 'Invite: not detected',
    verification ? 'Status: waiting to verify' : null,
    memberCount ? `Members now: **${memberCount}**` : null,
  ].filter(Boolean);
  return new EmbedBuilder().setTitle('👋 New member').setDescription(lines.join('\n')).setColor(0x2e7d32).setTimestamp(new Date(now));
}

/** DM every recipient. Never throws; closed DMs are skipped. */
export async function sendJoinAlerts(context, member, info = {}) {
  const recipients = await loadRecipients(context.db, member.guild.id);
  if (!recipients.length || member.user.bot) return 0;
  const embed = joinAlertEmbed({
    guildName: member.guild.name,
    memberCount: member.guild.memberCount,
    userId: member.id,
    username: member.user.username,
    createdTimestamp: member.user.createdTimestamp,
    ...info,
  });
  let sent = 0;
  for (const id of recipients) {
    if (id === member.id) continue;
    const user = await context.client.users.fetch(id).catch(() => null);
    if (user && await user.send({ embeds: [embed] }).then(() => true).catch(() => false)) sent += 1;
  }
  return sent;
}

/** /joinalerts on|off|list */
export async function handleJoinAlertsCommand(context, interaction) {
  if (!interaction.member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'Manage Server permission is required.', ephemeral: true });
    return;
  }
  const sub = interaction.options.getSubcommand();
  const current = await loadRecipients(context.db, interaction.guild.id);
  if (sub === 'list') {
    await interaction.reply({ content: current.length ? `Join alerts go to: ${current.map((id) => `<@${id}>`).join(', ')}` : 'Nobody gets join alerts yet. Use `/joinalerts on`.', ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }
  const target = interaction.options.getUser('user') || interaction.user;
  const next = sub === 'on' ? [...current, target.id] : current.filter((id) => id !== target.id);
  await saveRecipients(context.db, interaction.guild.id, next);
  let note = '';
  if (sub === 'on') {
    const ok = await target.send({ content: `✅ You'll get a DM from me every time someone joins **${interaction.guild.name}**.` }).then(() => true).catch(() => false);
    if (!ok) note = '\n⚠️ I could not DM them: they need to allow DMs from server members (Privacy Settings for this server).';
  }
  await interaction.reply({ content: `${sub === 'on' ? 'Join alerts on' : 'Join alerts off'} for ${target}.${note}`, ephemeral: true, allowedMentions: { parse: [] } });
}
