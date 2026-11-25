import { PermissionsBitField } from 'discord.js';
import { isModuleEnabled } from '../db/index.js';

// Rules live in automation_rules (rule_type 'automod'). trigger keys:
//   blockInvites       other servers' invite links (this server's own invites and vanity are allowed)
//   blockLinks         any http(s) link
//   blockedWords       [words] whole-word, case-insensitive (phrases match as written)
//   blockAttachments   any attachment
//   maxMentions        more than N user/role mentions in one message (@everyone counts as 5)
//   flood              { messages, seconds }: more than N messages in S seconds from one member
//   newMemberLinks     { hours }: links from members who joined less than H hours ago
// actions: [{ type: 'delete' } | { type: 'reply', message } | { type: 'timeout', durationSeconds }]
// Staff (Manage Messages or Administrator), bots and webhooks are never auto-moderated.

const invitePattern = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-z0-9-]+)/gi;
const urlPattern = /https?:\/\/\S+/i;
const RULE_CACHE_MS = 30_000;

const ruleCache = new Map(); // guildId -> { at, rules }
const recentMessages = new Map(); // `${guildId}:${userId}` -> [timestamps]
const lastInviteRefresh = new Map(); // guildId -> ms

export function resetAutomodState() {
  ruleCache.clear();
  recentMessages.clear();
  lastInviteRefresh.clear();
}

export function invalidateAutomodRules(guildId) {
  ruleCache.delete(guildId);
}

export function isStaff(member) {
  const perms = member?.permissions;
  if (!perms?.has) return false;
  return perms.has(PermissionsBitField.Flags.Administrator) || perms.has(PermissionsBitField.Flags.ManageMessages);
}

export function inviteCodes(content) {
  return [...String(content || '').matchAll(invitePattern)].map((match) => match[1]);
}

export function containsBlockedWord(content, words) {
  const text = String(content || '').toLowerCase();
  return (words || []).some((raw) => {
    const word = String(raw || '').trim().toLowerCase();
    if (!word) return false;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text);
  });
}

export function mentionCount(message) {
  return (message.mentions?.users?.size || 0) + (message.mentions?.roles?.size || 0) + (message.mentions?.everyone ? 5 : 0);
}

/** Record one message and say whether this member is over the flood limit. */
export function isFlooding(key, flood, now = Date.now()) {
  const limit = Number(flood?.messages || 0);
  const windowMs = Number(flood?.seconds || 0) * 1000;
  if (!limit || !windowMs) return false;
  const list = (recentMessages.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  recentMessages.set(key, list);
  return list.length > limit;
}

async function loadRules(context, guildId) {
  const cached = ruleCache.get(guildId);
  if (cached && Date.now() - cached.at < RULE_CACHE_MS) return cached.rules;
  const result = await context.db.query(
    'SELECT * FROM automation_rules WHERE guild_id = $1 AND rule_type = $2 AND enabled = TRUE ORDER BY id',
    [guildId, 'automod'],
  );
  ruleCache.set(guildId, { at: Date.now(), rules: result.rows });
  return result.rows;
}

async function isOwnInvite(guild, code) {
  if (guild.vanityURLCode && guild.vanityURLCode.toLowerCase() === code.toLowerCase()) return true;
  const { isKnownInviteCode, refreshInviteCache } = await import('./inviteRoleService.js');
  if (isKnownInviteCode(guild.id, code)) return true;
  const last = lastInviteRefresh.get(guild.id) || 0;
  if (Date.now() - last < 60_000) return false;
  lastInviteRefresh.set(guild.id, Date.now());
  await refreshInviteCache(guild);
  return isKnownInviteCode(guild.id, code);
}

/** Which part of the trigger matched (a short reason), or null. */
export async function matchRule(message, trigger, { now = Date.now(), ownInvite = isOwnInvite } = {}) {
  const content = message.content || '';
  if (trigger.blockInvites) {
    for (const code of inviteCodes(content)) {
      if (!(await ownInvite(message.guild, code))) return 'invite link';
    }
  }
  if (trigger.blockLinks && urlPattern.test(content)) return 'link';
  if (Array.isArray(trigger.blockedWords) && containsBlockedWord(content, trigger.blockedWords)) return 'blocked word';
  if (trigger.blockAttachments && message.attachments?.size > 0) return 'attachment';
  if (Number.isInteger(trigger.maxMentions) && mentionCount(message) > trigger.maxMentions) return 'mention spam';
  if (trigger.newMemberLinks && urlPattern.test(content)) {
    const joined = message.member?.joinedTimestamp;
    const hours = Number(trigger.newMemberLinks.hours || 24);
    if (joined && now - joined < hours * 3600_000) return 'link from a new member';
  }
  if (trigger.flood && isFlooding(`${message.guild.id}:${message.author.id}`, trigger.flood, now)) return 'message flood';
  return null;
}

export async function runAutomod(context, message) {
  if (!message.guild || message.author.bot || message.webhookId) return;
  if (isStaff(message.member)) return;
  if (!(await isModuleEnabled(context.db, message.guild.id, 'automod'))) return;

  for (const rule of await loadRules(context, message.guild.id)) {
    const reason = await matchRule(message, rule.trigger || {});
    if (reason) {
      await applyAutomodActions(context, message, rule.actions || [], rule.id, reason);
      break;
    }
  }
}

async function applyAutomodActions(context, message, actions, ruleId, reason) {
  const done = [];
  for (const action of actions) {
    if (action.type === 'delete') {
      if (await message.delete().then(() => true).catch(() => false)) done.push('deleted');
    }
    if (action.type === 'reply' && action.message) {
      const sent = await message.channel.send({ content: `${message.author}, ${action.message}`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
      if (sent) setTimeout(() => sent.delete().catch(() => null), 10_000).unref?.();
    }
    if (action.type === 'timeout') {
      const seconds = Number(action.durationSeconds || 60);
      if (await message.member?.timeout?.(seconds * 1000, `AutoMod: ${reason}`).then(() => true).catch(() => false)) done.push(`timed out ${seconds}s`);
    }
  }

  await context.audit.record({
    guildId: message.guild.id,
    actorId: message.author.id,
    targetId: message.channel.id,
    action: 'automod.triggered',
    source: 'discord',
    details: { ruleId, reason, messageId: message.id, done },
  });

  const { getLogChannelId } = await import('./inviteRoleService.js');
  const logId = await getLogChannelId(context.db, message.guild.id);
  const channel = logId ? await message.guild.channels.fetch(logId).catch(() => null) : null;
  if (channel?.isTextBased?.()) {
    const excerpt = String(message.content || '').replace(/`/g, "'").slice(0, 300);
    await channel.send({
      content: `🛡️ AutoMod (${reason}): ${message.author} in ${message.channel}: ${done.join(', ') || 'flagged'}.${excerpt ? `\n\`\`\`${excerpt}\`\`\`` : ''}`,
      allowedMentions: { parse: [] },
    }).catch(() => null);
  }
}

// ---------- raid alert ----------

const joinTimes = new Map(); // guildId -> [ms]
const lastRaidAlert = new Map(); // guildId -> ms
export const RAID_JOINS = 8;
export const RAID_WINDOW_MS = 60_000;

/** Record a join; true when this join pushes the guild over the raid threshold (alerts at most every 10 min). */
export function trackJoin(guildId, now = Date.now()) {
  const list = (joinTimes.get(guildId) || []).filter((t) => now - t < RAID_WINDOW_MS);
  list.push(now);
  joinTimes.set(guildId, list);
  if (list.length < RAID_JOINS) return false;
  if (lastRaidAlert.has(guildId) && now - lastRaidAlert.get(guildId) < 10 * 60_000) return false;
  lastRaidAlert.set(guildId, now);
  return true;
}

export function resetRaidState() {
  joinTimes.clear();
  lastRaidAlert.clear();
}

/** The `/automod protect` bundle: sensible defaults for a server about to share invite links. */
export const PROTECT_RULES = [
  { trigger: { blockInvites: true }, actions: [{ type: 'delete' }, { type: 'reply', message: 'invite links to other servers are not allowed here.' }] },
  { trigger: { maxMentions: 5 }, actions: [{ type: 'delete' }, { type: 'timeout', durationSeconds: 600 }] },
  { trigger: { flood: { messages: 6, seconds: 8 } }, actions: [{ type: 'delete' }, { type: 'timeout', durationSeconds: 300 }, { type: 'reply', message: 'slow down a little, please.' }] },
  { trigger: { newMemberLinks: { hours: 24 } }, actions: [{ type: 'delete' }, { type: 'reply', message: 'new members can share links after their first day.' }] },
];

/** Install (or re-install) the protect bundle. Older protect rules are switched off, other rules are kept. */
export async function installProtectRules(db, guildId) {
  await db.query(
    "UPDATE automation_rules SET enabled = FALSE, updated_at = NOW() WHERE guild_id = $1 AND rule_type = 'automod' AND trigger->>'preset' = 'protect'",
    [guildId],
  );
  for (const rule of PROTECT_RULES) {
    await db.query(
      "INSERT INTO automation_rules (guild_id, rule_type, trigger, actions, enabled) VALUES ($1, 'automod', $2, $3, TRUE)",
      [guildId, JSON.stringify({ ...rule.trigger, preset: 'protect' }), JSON.stringify(rule.actions)],
    );
  }
  await db.query(
    `INSERT INTO module_settings (guild_id, module_name, enabled, config, updated_at) VALUES ($1, 'automod', TRUE, '{}'::jsonb, NOW())
     ON CONFLICT (guild_id, module_name) DO UPDATE SET enabled = TRUE, updated_at = NOW()`,
    [guildId],
  );
  invalidateAutomodRules(guildId);
}
