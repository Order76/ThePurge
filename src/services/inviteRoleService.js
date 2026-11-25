// Invite roles: permanent invite links that each give a role to whoever joins through them.
// Discord does not say which invite a member used, so we keep each guild's invite use counts and
// compare them when someone joins: the one invite whose count went up is the one they used.
// Roles that carry moderation or admin power are never given automatically: staff approve them.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const MODULE = 'inviteroles';

const PRIVILEGED = [
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageMessages', 'ManageThreads',
  'ManageWebhooks', 'ManageNicknames', 'ManageGuildExpressions', 'ManageEvents', 'KickMembers', 'BanMembers',
  'ModerateMembers', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'MentionEveryone', 'ViewAuditLog',
];

/** True when a role must be approved by staff instead of given automatically. */
export function isPrivilegedRole(role) {
  const bits = BigInt(role?.permissions?.bitfield ?? role?.permissions ?? 0);
  return PRIVILEGED.some((name) => (bits & PermissionFlagsBits[name]) === PermissionFlagsBits[name]);
}

/** Roles that get a link: everything except @everyone, bot-managed roles and roles above the bot. */
export function linkableRoles(guild, botHighestPosition) {
  return [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id && !role.managed && role.position < botHighestPosition)
    .sort((a, b) => b.position - a.position);
}

/**
 * Which invite was used: the single code whose use count went up (or that is new with uses > 0).
 * Returns null when none or more than one changed (two people joined at once), so nothing is guessed.
 */
export function findUsedInvite(before, after) {
  const changed = [];
  for (const invite of after) {
    const old = before.get(invite.code) ?? 0;
    if ((invite.uses ?? 0) > old) changed.push(invite.code);
  }
  return changed.length === 1 ? changed[0] : null;
}

export function approvalIds(userId, roleId) {
  return { approve: `inviterole:approve:${userId}:${roleId}`, deny: `inviterole:deny:${userId}:${roleId}` };
}

export function parseApprovalId(customId) {
  const [ns, action, userId, roleId] = String(customId || '').split(':');
  if (ns !== 'inviterole' || !['approve', 'deny'].includes(action) || !/^\d{5,25}$/.test(userId || '') || !/^\d{5,25}$/.test(roleId || '')) return null;
  return { action, userId, roleId };
}

// ---------- storage (module_settings, module 'inviteroles': { links: { code: { roleId, label } } }) ----------

export async function loadLinks(db, guildId) {
  const result = await db.query(
    "SELECT config FROM module_settings WHERE guild_id = $1 AND module_name = $2 AND enabled = TRUE",
    [guildId, MODULE],
  );
  return result.rows[0]?.config?.links || {};
}

export async function saveLinks(db, guildId, links) {
  await db.query(
    `
    INSERT INTO module_settings (guild_id, module_name, enabled, config, updated_at)
    VALUES ($1, $2, TRUE, $3, NOW())
    ON CONFLICT (guild_id, module_name) DO UPDATE SET
      enabled = TRUE,
      config = module_settings.config || EXCLUDED.config,
      updated_at = NOW();
    `,
    [guildId, MODULE, JSON.stringify({ links })],
  );
}

/** Staff log channel: the tickets module's log channel, else the server log channel. */
export async function getLogChannelId(db, guildId) {
  const result = await db.query(
    `
    SELECT COALESCE(m.config->>'logChannelId', g.log_channel_id) AS channel_id
    FROM guild_settings g
    LEFT JOIN module_settings m ON m.guild_id = g.guild_id AND m.module_name = 'tickets'
    WHERE g.guild_id = $1;
    `,
    [guildId],
  );
  return result.rows[0]?.channel_id || null;
}

// ---------- use-count cache ----------

const useCache = new Map(); // guildId -> Map(code -> uses)

export async function refreshInviteCache(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return null;
  const counts = new Map([...invites.values()].map((invite) => [invite.code, invite.uses ?? 0]));
  useCache.set(guild.id, counts);
  return invites;
}

export function rememberInvite(invite) {
  if (!invite?.guild?.id) return;
  const counts = useCache.get(invite.guild.id) || new Map();
  counts.set(invite.code, invite.uses ?? 0);
  useCache.set(invite.guild.id, counts);
}

/** True when the code is a live invite to this guild that the bot has seen (used by automod's allow-list). */
export function isKnownInviteCode(guildId, code) {
  return Boolean(useCache.get(guildId)?.has(code));
}

export function forgetInvite(invite) {
  useCache.get(invite?.guild?.id)?.delete(invite.code);
}

/** Create one permanent invite per linkable role and save the mapping. Existing links are kept. */
export async function createRoleInvites(context, guild, channel, actor) {
  const me = guild.members.me || await guild.members.fetchMe();
  const links = await loadLinks(context.db, guild.id);
  const invites = await refreshInviteCache(guild);
  const liveCodes = new Set(invites ? [...invites.keys()] : []);
  const out = [];
  for (const role of linkableRoles(guild, me.roles.highest.position)) {
    const existing = Object.entries(links).find(([code, link]) => link.roleId === role.id && liveCodes.has(code));
    if (existing) { out.push({ role, code: existing[0], created: false }); continue; }
    const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: `Role invite for ${role.name} (by ${actor?.username || actor?.id || 'staff'})` });
    links[invite.code] = { roleId: role.id, label: role.name };
    rememberInvite(invite);
    out.push({ role, code: invite.code, created: true });
  }
  await saveLinks(context.db, guild.id, links);
  return out.map((item) => ({ ...item, url: `https://discord.gg/${item.code}`, approval: isPrivilegedRole(item.role) }));
}

/** On join: which role invite did this member use? Returns { role, code } or null. Must run at join time. */
export async function resolveInviteRole(context, member) {
  const guild = member.guild;
  const links = await loadLinks(context.db, guild.id);
  if (Object.keys(links).length === 0) return null;
  const before = useCache.get(guild.id) || new Map();
  const invites = await refreshInviteCache(guild);
  if (!invites) return null;
  const code = findUsedInvite(before, [...invites.values()]);
  const link = code ? links[code] : null;
  if (!link) return null;
  const role = guild.roles.cache.get(link.roleId) || await guild.roles.fetch(link.roleId).catch(() => null);
  if (!role) return null;
  return { role, code };
}

/** On join: give the role for the invite used, or ask staff to approve a privileged one. Never throws. */
export async function handleInviteRoleJoin(context, member, { logChannelId } = {}) {
  const found = await resolveInviteRole(context, member);
  if (!found) return null;
  return grantInviteRole(context, member, found.role, found.code, { logChannelId });
}

/** Give an invite role now, or post a staff Give/Decline prompt when the role has staff powers. */
export async function grantInviteRole(context, member, role, code, { logChannelId } = {}) {
  const guild = member.guild;
  if (!isPrivilegedRole(role)) {
    await member.roles.add(role, `Joined with the ${role.name} invite (${code})`);
    await context.audit?.record?.({ guildId: guild.id, targetId: member.id, action: 'inviterole.given', source: 'discord', details: { code, roleId: role.id } });
    return { given: role.id, code };
  }

  const channel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;
  if (channel?.isTextBased?.()) {
    const ids = approvalIds(member.id, role.id);
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(`Approve ${role.name}?`)
        .setDescription(`${member} joined with the **${role.name}** invite. This role has staff powers, so it needs approval.`)
        .setColor(0xe0a526)
        .setTimestamp(new Date())],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(ids.approve).setLabel(`Give ${role.name}`.slice(0, 80)).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(ids.deny).setLabel('Decline').setStyle(ButtonStyle.Secondary),
      )],
      allowedMentions: { parse: [] },
    });
  }
  await context.audit?.record?.({ guildId: guild.id, targetId: member.id, action: 'inviterole.pending', source: 'discord', details: { code, roleId: role.id } });
  return { pending: role.id, code };
}

/** Staff press Give / Decline on a privileged invite role. */
export async function handleApprovalButton(context, interaction) {
  const parsed = parseApprovalId(interaction.customId);
  if (!parsed) return;
  const clicker = interaction.member;
  if (!clicker?.permissions?.has?.(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: 'You need Manage Roles to approve this.', ephemeral: true });
    return;
  }
  const role = interaction.guild.roles.cache.get(parsed.roleId);
  if (parsed.action === 'approve') {
    if (!role || role.position >= clicker.roles.highest.position && interaction.guild.ownerId !== clicker.id) {
      await interaction.reply({ content: 'You can only give roles below your own highest role.', ephemeral: true });
      return;
    }
    const member = await interaction.guild.members.fetch(parsed.userId).catch(() => null);
    if (!member) { await interaction.reply({ content: 'That member has left the server.', ephemeral: true }); return; }
    await member.roles.add(role, `Invite role approved by ${clicker.user?.username || clicker.id}`);
  }
  await interaction.update({
    content: parsed.action === 'approve' ? `✅ ${role} given to <@${parsed.userId}> by ${clicker}.` : `Declined by ${clicker}. <@${parsed.userId}> keeps their other roles.`,
    embeds: [],
    components: [],
    allowedMentions: { parse: [] },
  });
  await context.audit?.record?.({ guildId: interaction.guild.id, actorId: clicker.id, targetId: parsed.userId, action: `inviterole.${parsed.action}`, source: 'discord', details: { roleId: parsed.roleId } });
}
