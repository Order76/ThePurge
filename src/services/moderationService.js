export async function runModerationAction(context, options) {
  const { canModerateTarget } = await import('./permissionService.js');
  const { db, audit } = context;
  const { interaction, action, targetUser, reason = 'No reason provided.', durationSeconds = null, deleteMessages = false } = options;
  const guild = interaction.guild;
  const actor = interaction.member;
  const botMember = await guild.members.fetchMe();
  const targetMember = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;

  if (action === 'unban') {
    const { PermissionsBitField } = await import('discord.js');
    if (!actor?.permissions?.has(PermissionsBitField.Flags.BanMembers)) return { ok: false, message: 'Missing Discord permission for unban.' };
  } else if (action === 'ban' && !targetMember) {
    // Not in the server (left, or never joined): a pre-emptive ban by ID only needs the permission.
    const { PermissionsBitField } = await import('discord.js');
    if (!actor?.permissions?.has(PermissionsBitField.Flags.BanMembers)) return { ok: false, message: 'Missing Discord permission for ban.' };
  } else if (action !== 'purge') {
    const check = canModerateTarget(actor, targetMember, botMember, action);
    if (!check.ok) return { ok: false, message: check.reason };
  }

  if (['warn', 'timeout', 'kick', 'ban'].includes(action) && targetMember) {
    await notifyTarget(targetUser, guild, action, reason, durationSeconds);
  }

  let status = 'open';
  let message = '';

  if (action === 'warn') {
    message = `Warned ${targetUser.tag}.`;
  } else if (action === 'timeout') {
    await targetMember.timeout(durationSeconds * 1000, reason);
    message = `Timed out ${targetUser.tag} for ${durationSeconds} seconds.`;
  } else if (action === 'kick') {
    await targetMember.kick(reason);
    status = 'closed';
    message = `Kicked ${targetUser.tag}.`;
  } else if (action === 'ban') {
    await guild.members.ban(targetUser.id, { reason, deleteMessageSeconds: deleteMessages ? 86_400 : 0 });
    status = 'closed';
    message = `Banned ${targetUser.tag}.`;
  } else if (action === 'unban') {
    await guild.members.unban(targetUser.id, reason);
    status = 'closed';
    message = `Unbanned ${targetUser.tag}.`;
  } else {
    return { ok: false, message: `Unsupported moderation action: ${action}` };
  }

  const result = await db.query(
    `
    INSERT INTO moderation_cases (guild_id, case_type, actor_id, target_id, reason, duration_seconds, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
    `,
    [guild.id, action, actor.id, targetUser.id, reason, durationSeconds, status],
  );

  await audit.record({
    guildId: guild.id,
    actorId: actor.id,
    targetId: targetUser.id,
    action: `moderation.${action}`,
    source: 'discord',
    details: { reason, durationSeconds, caseId: result.rows[0].id },
  });

  return { ok: true, message: `${message} Case #${result.rows[0].id}.` };
}

const NOTICE = { warn: 'You received a warning', timeout: 'You were timed out', kick: 'You were kicked', ban: 'You were banned' };

/** Best-effort DM so people know why; closed DMs are fine. */
async function notifyTarget(user, guild, action, reason, durationSeconds) {
  const extra = action === 'timeout' && durationSeconds ? ` for ${Math.round(durationSeconds / 60) || 1} min` : '';
  await user.send({ content: `${NOTICE[action]}${extra} in **${guild.name}**. Reason: ${reason}` }).catch(() => null);
}

/** A user's moderation history in this guild, newest first. */
export async function listCases(db, guildId, userId, limit = 15) {
  const result = await db.query(
    `SELECT id, case_type, actor_id, reason, duration_seconds, created_at
     FROM moderation_cases WHERE guild_id = $1 AND target_id = $2 ORDER BY id DESC LIMIT $3`,
    [guildId, userId, limit],
  );
  return result.rows;
}

export function formatCases(rows) {
  if (!rows.length) return 'No moderation history.';
  return rows.map((row) => {
    const when = Math.floor(new Date(row.created_at).getTime() / 1000);
    const dur = row.duration_seconds ? ` ${row.duration_seconds}s` : '';
    return `#${row.id} **${row.case_type}**${dur} <t:${when}:R> by <@${row.actor_id}>: ${String(row.reason || '').slice(0, 120)}`;
  }).join('\n');
}

export async function purgeChannelMessages(context, options) {
  const { db, audit } = context;
  const { interaction, channel, mediaType = 'all', limit = 100, reason = 'Manual purge' } = options;
  assertCanManageMessages(channel, context.client.user);
  const messages = await fetchMessagesForPurge(channel, limit);
  const filtered = messages.filter((message) => matchesMediaType(message, mediaType));
  const result = await deleteMessagesIndividually(filtered);

  await db.query(
    `
    INSERT INTO purge_configs (guild_id, channel_id, media_type, last_run, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (guild_id, channel_id) DO UPDATE SET
      media_type = EXCLUDED.media_type,
      last_run = NOW(),
      updated_at = NOW();
    `,
    [interaction.guild.id, channel.id, mediaType],
  );

  await audit.record({
    guildId: interaction.guild.id,
    actorId: interaction.user.id,
    targetId: channel.id,
    action: 'moderation.purge',
    source: 'discord',
    details: {
      mediaType,
      requestedLimit: limit,
      inspectedCount: messages.length,
      matchedCount: filtered.length,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
      reason,
    },
  });

  return {
    ...result,
    inspectedCount: messages.length,
    matchedCount: filtered.length,
  };
}
import {
  assertCanManageMessages,
  deleteMessagesIndividually,
  fetchMessagesForPurge,
  matchesMediaType,
} from './mediaService.js';
