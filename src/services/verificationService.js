// Human verification: new members get no talking role until they pass a small picture puzzle
// ("Tap the pumpkin" among eight farm emoji). Passing gives the verified role (normally Member) plus
// any role their invite link carries. Very new Discord accounts go to staff for approval instead.
// Settings live in module_settings, module 'verification':
//   { enabled, channelId, roleId, logChannelId, minAccountAgeDays, panelMessageId }
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { randomInt, randomBytes } from 'node:crypto';

export const MODULE = 'verification';
export const OPTIONS_PER_CHALLENGE = 8;
export const MAX_ATTEMPTS = 3;
export const CHALLENGE_TTL_MS = 3 * 60 * 1000;
export const COOLDOWN_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PICTURES = [
  { emoji: '🐔', name: 'chicken' }, { emoji: '🐄', name: 'cow' }, { emoji: '🐑', name: 'sheep' },
  { emoji: '🐖', name: 'pig' }, { emoji: '🌻', name: 'sunflower' }, { emoji: '🌽', name: 'corn' },
  { emoji: '🥕', name: 'carrot' }, { emoji: '🍅', name: 'tomato' }, { emoji: '🎃', name: 'pumpkin' },
  { emoji: '🍓', name: 'strawberry' }, { emoji: '🐟', name: 'fish' }, { emoji: '🍞', name: 'bread' },
  { emoji: '🥚', name: 'egg' }, { emoji: '🍎', name: 'apple' }, { emoji: '🐝', name: 'bee' },
  { emoji: '🌾', name: 'wheat' },
];

// ---------- pure helpers (tested) ----------

/** A new challenge: a target picture and OPTIONS_PER_CHALLENGE shuffled options that include it. */
export function makeChallenge(rand = randomInt) {
  const pool = PICTURES.map((_, index) => index);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const options = pool.slice(0, OPTIONS_PER_CHALLENGE);
  const answer = options[rand(options.length)];
  return { nonce: randomBytes(6).toString('hex'), answer, options, expiresAt: Date.now() + CHALLENGE_TTL_MS };
}

export function pickId(nonce, index) {
  return `verify:pick:${nonce}:${index}`;
}

export function parseVerifyId(customId) {
  const parts = String(customId || '').split(':');
  if (parts[0] !== 'verify') return null;
  if (parts[1] === 'start' && parts.length === 2) return { action: 'start' };
  if (parts[1] === 'pick' && /^[0-9a-f]{12}$/.test(parts[2] || '') && /^\d{1,2}$/.test(parts[3] || '')) {
    return { action: 'pick', nonce: parts[2], index: Number(parts[3]) };
  }
  if ((parts[1] === 'approve' || parts[1] === 'deny') && /^\d{5,25}$/.test(parts[2] || '')) {
    return { action: parts[1], userId: parts[2] };
  }
  return null;
}

/** Account age in whole days from a Discord user's creation time. */
export function accountAgeDays(createdTimestamp, now = Date.now()) {
  return Math.floor((now - Number(createdTimestamp || now)) / DAY_MS);
}

export function needsStaffReview(createdTimestamp, minAccountAgeDays, now = Date.now()) {
  const min = Number(minAccountAgeDays || 0);
  return min > 0 && accountAgeDays(createdTimestamp, now) < min;
}

// ---------- settings ----------

export async function loadSettings(db, guildId) {
  const result = await db.query(
    'SELECT enabled, config FROM module_settings WHERE guild_id = $1 AND module_name = $2',
    [guildId, MODULE],
  );
  const row = result.rows[0];
  if (!row || !row.enabled || !row.config?.roleId) return null;
  return row.config;
}

export async function saveSettings(db, guildId, config, enabled = true) {
  await db.query(
    `
    INSERT INTO module_settings (guild_id, module_name, enabled, config, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (guild_id, module_name) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      config = module_settings.config || EXCLUDED.config,
      updated_at = NOW();
    `,
    [guildId, MODULE, enabled, JSON.stringify(config)],
  );
}

// ---------- pending members (who joined, and which invite role is waiting for them) ----------

export async function recordPending(db, guildId, userId, { inviteRoleId = null, inviteCode = null } = {}) {
  await db.query(
    `
    INSERT INTO verification_pending (guild_id, user_id, invite_role_id, invite_code, status, joined_at, updated_at)
    VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
    ON CONFLICT (guild_id, user_id) DO UPDATE SET
      invite_role_id = EXCLUDED.invite_role_id,
      invite_code = EXCLUDED.invite_code,
      status = 'pending',
      joined_at = NOW(),
      updated_at = NOW();
    `,
    [guildId, userId, inviteRoleId, inviteCode],
  );
}

async function takePending(db, guildId, userId, status) {
  const result = await db.query(
    `UPDATE verification_pending SET status = $3, updated_at = NOW()
     WHERE guild_id = $1 AND user_id = $2 RETURNING invite_role_id, invite_code`,
    [guildId, userId, status],
  );
  return result.rows[0] || null;
}

// ---------- in-memory challenge state ----------

const challenges = new Map(); // `${guildId}:${userId}` -> { nonce, answer, options, expiresAt, attempts }
const cooldowns = new Map(); // `${guildId}:${userId}` -> until (ms)

export function resetVerificationState() {
  challenges.clear();
  cooldowns.clear();
}

// ---------- Discord side ----------

export function panelMessage() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle('🌿 Verify to join the valley')
      .setDescription('Tap **Verify** and pick the picture we ask for. It takes five seconds and keeps spam bots out.\n\nOnce you pass, you can chat, play and join the voice channels.')
      .setColor(0x2e7d32)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:start').setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success),
    )],
  };
}

export async function postPanel(channel) {
  return channel.send(panelMessage());
}

function challengeMessage(challenge, note = '') {
  const target = PICTURES[challenge.answer];
  const buttons = challenge.options.map((index) => new ButtonBuilder()
    .setCustomId(pickId(challenge.nonce, index))
    .setEmoji(PICTURES[index].emoji)
    .setStyle(ButtonStyle.Secondary));
  return {
    content: `${note}Tap the **${target.name}**.`,
    components: [
      new ActionRowBuilder().addComponents(buttons.slice(0, 4)),
      new ActionRowBuilder().addComponents(buttons.slice(4, 8)),
    ],
  };
}

async function sendLog(guild, logChannelId, payload) {
  if (!logChannelId) return;
  const channel = await guild.channels.fetch(logChannelId).catch(() => null);
  if (channel?.isTextBased?.()) await channel.send({ allowedMentions: { parse: [] }, ...payload }).catch(() => null);
}

/** Give the verified role and any invite role that was waiting. */
export async function completeVerification(context, member, settings, { by = 'puzzle' } = {}) {
  const guild = member.guild;
  await member.roles.add(settings.roleId, `Verified (${by})`);
  const pending = await takePending(context.db, guild.id, member.id, 'verified');
  let inviteNote = '';
  if (pending?.invite_role_id) {
    const { grantInviteRole } = await import('./inviteRoleService.js');
    const role = guild.roles.cache.get(pending.invite_role_id) || await guild.roles.fetch(pending.invite_role_id).catch(() => null);
    if (role) {
      const result = await grantInviteRole(context, member, role, pending.invite_code, { logChannelId: settings.logChannelId });
      inviteNote = result?.given ? ` + ${role.name}` : result?.pending ? ` (${role.name} awaits staff approval)` : '';
    }
  }
  await sendLog(guild, settings.logChannelId, {
    content: `✅ ${member} verified by ${by}. Account age ${accountAgeDays(member.user.createdTimestamp)} days.${inviteNote}`,
  });
  await context.audit?.record?.({ guildId: guild.id, targetId: member.id, action: 'verification.passed', source: 'discord', details: { by } });
}

/** On join while verification is on: remember which invite role is waiting. Never throws. */
export async function handleVerificationJoin(context, member, settings) {
  let inviteRoleId = null;
  let inviteCode = null;
  try {
    const { resolveInviteRole } = await import('./inviteRoleService.js');
    const found = await resolveInviteRole(context, member);
    inviteRoleId = found?.role?.id || null;
    inviteCode = found?.code || null;
  } catch (error) {
    console.error('[verification] invite lookup failed', error);
  }
  await recordPending(context.db, member.guild.id, member.id, { inviteRoleId, inviteCode });
  const age = accountAgeDays(member.user.createdTimestamp);
  await sendLog(member.guild, settings.logChannelId, {
    content: `👋 ${member} joined (account ${age} days old${inviteCode ? `, invite ${inviteCode}` : ''}). Waiting for verification.`,
  });
}

async function startChallenge(interaction, key, note = '') {
  const challenge = { ...makeChallenge(), attempts: challenges.get(key)?.attempts || 0 };
  challenges.set(key, challenge);
  return challengeMessage(challenge, note);
}

export async function handleVerifyButton(context, interaction) {
  const parsed = parseVerifyId(interaction.customId);
  if (!parsed || !interaction.guild) return;
  const settings = await loadSettings(context.db, interaction.guild.id);
  if (!settings) {
    await interaction.reply({ content: 'Verification is not switched on here.', ephemeral: true });
    return;
  }

  if (parsed.action === 'approve' || parsed.action === 'deny') {
    await handleStaffDecision(context, interaction, settings, parsed);
    return;
  }

  const member = interaction.member;
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  if (member?.roles?.cache?.has?.(settings.roleId)) {
    await interaction.reply({ content: 'You are already verified. Welcome back!', ephemeral: true });
    return;
  }
  const until = cooldowns.get(key) || 0;
  if (until > Date.now()) {
    await interaction.reply({ content: `Too many wrong picks. Try again <t:${Math.ceil(until / 1000)}:R>.`, ephemeral: true });
    return;
  }

  if (parsed.action === 'start') {
    challenges.delete(key);
    await interaction.reply({ ...(await startChallenge(interaction, key)), ephemeral: true });
    return;
  }

  // pick
  const challenge = challenges.get(key);
  if (!challenge || challenge.nonce !== parsed.nonce || challenge.expiresAt < Date.now()) {
    await interaction.update({ ...(await startChallenge(interaction, key, 'That puzzle expired. Here is a new one. ')) });
    return;
  }

  if (parsed.index === challenge.answer) {
    challenges.delete(key);
    if (needsStaffReview(interaction.user.createdTimestamp, settings.minAccountAgeDays)) {
      await requestStaffReview(context, interaction, settings);
      await interaction.update({ content: 'Thanks! Your Discord account is very new, so a staff member will let you in shortly.', components: [] });
      return;
    }
    const fullMember = await interaction.guild.members.fetch(interaction.user.id);
    await completeVerification(context, fullMember, settings);
    await interaction.update({ content: '🌿 Welcome to the valley! You can chat and play now.', components: [] });
    return;
  }

  challenge.attempts += 1;
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(key);
    cooldowns.set(key, Date.now() + COOLDOWN_MS);
    await sendLog(interaction.guild, settings.logChannelId, { content: `⚠️ <@${interaction.user.id}> failed verification ${MAX_ATTEMPTS} times (10-minute cooldown).` });
    await context.audit?.record?.({ guildId: interaction.guild.id, targetId: interaction.user.id, action: 'verification.failed', source: 'discord' });
    await interaction.update({ content: 'Not quite. Please try again in 10 minutes.', components: [] });
    return;
  }
  await interaction.update({ ...(await startChallenge(interaction, key, 'Not that one. ')) });
}

async function requestStaffReview(context, interaction, settings) {
  const age = accountAgeDays(interaction.user.createdTimestamp);
  await sendLog(interaction.guild, settings.logChannelId, {
    embeds: [new EmbedBuilder()
      .setTitle('New account wants in')
      .setDescription(`<@${interaction.user.id}> passed the puzzle, but their Discord account is only **${age} days** old (minimum ${settings.minAccountAgeDays}).`)
      .setColor(0xe0a526)
      .setTimestamp(new Date())],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`verify:approve:${interaction.user.id}`).setLabel('Let them in').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`verify:deny:${interaction.user.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger),
    )],
  });
  await context.audit?.record?.({ guildId: interaction.guild.id, targetId: interaction.user.id, action: 'verification.review', source: 'discord', details: { age } });
}

async function handleStaffDecision(context, interaction, settings, parsed) {
  const clicker = interaction.member;
  const needed = parsed.action === 'approve' ? PermissionFlagsBits.ManageRoles : PermissionFlagsBits.KickMembers;
  if (!clicker?.permissions?.has?.(needed)) {
    await interaction.reply({ content: `You need ${parsed.action === 'approve' ? 'Manage Roles' : 'Kick Members'} for this.`, ephemeral: true });
    return;
  }
  const member = await interaction.guild.members.fetch(parsed.userId).catch(() => null);
  if (!member) {
    await interaction.update({ content: `<@${parsed.userId}> has already left.`, embeds: [], components: [] });
    return;
  }
  if (parsed.action === 'approve') {
    await completeVerification(context, member, settings, { by: `staff (${clicker.user?.username || clicker.id})` });
    await interaction.update({ content: `✅ ${member} let in by ${clicker}.`, embeds: [], components: [], allowedMentions: { parse: [] } });
  } else {
    await takePending(context.db, interaction.guild.id, member.id, 'kicked');
    await member.kick(`Verification declined by ${clicker.user?.username || clicker.id}`);
    await interaction.update({ content: `👢 <@${parsed.userId}> kicked by ${clicker}.`, embeds: [], components: [], allowedMentions: { parse: [] } });
  }
  await context.audit?.record?.({ guildId: interaction.guild.id, actorId: clicker.id, targetId: parsed.userId, action: `verification.${parsed.action}`, source: 'discord' });
}

// ---------- slash command: /verify ----------

export async function handleVerifyCommand(context, interaction) {
  const sub = interaction.options.getSubcommand();
  const needed = sub === 'approve' ? PermissionFlagsBits.ManageRoles : PermissionFlagsBits.ManageGuild;
  if (!interaction.member?.permissions?.has?.(needed)) {
    await interaction.reply({ content: `${sub === 'approve' ? 'Manage Roles' : 'Manage Server'} permission is required.`, ephemeral: true });
    return;
  }

  if (sub === 'setup') {
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);
    const logChannel = interaction.options.getChannel('log-channel');
    const minAccountAgeDays = interaction.options.getInteger('min-account-age-days') ?? 0;
    const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
    if (role.managed || role.id === interaction.guild.id || role.position >= me.roles.highest.position) {
      await interaction.reply({ content: `I can't give ${role}: it must be a normal role below mine.`, ephemeral: true });
      return;
    }
    const { getLogChannelId } = await import('./inviteRoleService.js');
    const logChannelId = logChannel?.id || await getLogChannelId(context.db, interaction.guild.id);
    const message = await postPanel(channel);
    await saveSettings(context.db, interaction.guild.id, {
      channelId: channel.id, roleId: role.id, logChannelId, minAccountAgeDays, panelMessageId: message.id,
    });
    await context.audit?.record?.({ guildId: interaction.guild.id, actorId: interaction.user.id, action: 'verification.setup', source: 'discord', details: { channelId: channel.id, roleId: role.id, minAccountAgeDays } });
    await interaction.reply({
      content: `Verification is on. Panel posted in ${channel}. New members get ${role} only after they pass`
        + `${minAccountAgeDays ? `; accounts younger than ${minAccountAgeDays} days go to staff` : ''}.`
        + '\nMake sure @everyone cannot send messages or speak, so the role is what lets people talk.',
      ephemeral: true,
    });
    return;
  }

  if (sub === 'off') {
    await saveSettings(context.db, interaction.guild.id, {}, false);
    await interaction.reply({ content: 'Verification is off. New members get the join role straight away again.', ephemeral: true });
    return;
  }

  if (sub === 'approve') {
    const settings = await loadSettings(context.db, interaction.guild.id);
    if (!settings) { await interaction.reply({ content: 'Verification is not switched on here.', ephemeral: true }); return; }
    const user = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) { await interaction.reply({ content: 'That person is not in the server.', ephemeral: true }); return; }
    await completeVerification(context, member, settings, { by: `staff (${interaction.user.username})` });
    await interaction.reply({ content: `✅ ${member} verified.`, ephemeral: true, allowedMentions: { parse: [] } });
  }
}
