import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionsBitField } from 'discord.js';
import {
  containsBlockedWord, inviteCodes, isFlooding, isStaff, matchRule, mentionCount, PROTECT_RULES,
  resetAutomodState, resetRaidState, trackJoin, RAID_JOINS,
} from '../src/services/automodService.js';
import { commandData } from '../src/bot/commands.js';

const msg = (content, extra = {}) => ({
  content, guild: { id: 'g' }, author: { id: 'u' }, attachments: { size: 0 },
  mentions: { users: { size: 0 }, roles: { size: 0 }, everyone: false }, member: { joinedTimestamp: 0 }, ...extra,
});

test('invite codes are found in all link forms', () => {
  assert.deepEqual(inviteCodes('join discord.gg/abc123 or https://discord.com/invite/XyZ and discordapp.com/invite/q-1'), ['abc123', 'XyZ', 'q-1']);
  assert.deepEqual(inviteCodes('no links here'), []);
});

test('own invites pass, outside invites are caught', async () => {
  const own = async (_g, code) => code === 'ours';
  assert.equal(await matchRule(msg('come to discord.gg/ours'), { blockInvites: true }, { ownInvite: own }), null);
  assert.equal(await matchRule(msg('come to discord.gg/theirs'), { blockInvites: true }, { ownInvite: own }), 'invite link');
});

test('blocked words match whole words only', () => {
  assert.equal(containsBlockedWord('what a scam!', ['scam']), true);
  assert.equal(containsBlockedWord('Scampi for dinner', ['scam']), false);
  assert.equal(containsBlockedWord('free nitro here', ['free nitro']), true);
  assert.equal(containsBlockedWord('anything', ['']), false);
});

test('mention spam counts users, roles and everyone', () => {
  assert.equal(mentionCount(msg('', { mentions: { users: { size: 3 }, roles: { size: 2 }, everyone: true } })), 10);
});

test('flood: more than N messages in the window', () => {
  resetAutomodState();
  const f = { messages: 3, seconds: 5 };
  assert.equal(isFlooding('k', f, 0), false);
  assert.equal(isFlooding('k', f, 1000), false);
  assert.equal(isFlooding('k', f, 2000), false);
  assert.equal(isFlooding('k', f, 3000), true);
  assert.equal(isFlooding('k', f, 20_000), false);
});

test('links from members who joined within the window are caught', async () => {
  const now = 10 * 3600_000;
  const t = { newMemberLinks: { hours: 24 } };
  assert.equal(await matchRule(msg('see https://x.y', { member: { joinedTimestamp: now - 3600_000 } }), t, { now }), 'link from a new member');
  assert.equal(await matchRule(msg('see https://x.y', { member: { joinedTimestamp: now - 48 * 3600_000 } }), t, { now: now + 48 * 3600_000 }), null);
  assert.equal(await matchRule(msg('no link', { member: { joinedTimestamp: now } }), t, { now }), null);
});

test('staff are recognised', () => {
  const p = (flag) => ({ permissions: new PermissionsBitField(flag) });
  assert.equal(isStaff(p(PermissionsBitField.Flags.ManageMessages)), true);
  assert.equal(isStaff(p(PermissionsBitField.Flags.Administrator)), true);
  assert.equal(isStaff(p(PermissionsBitField.Flags.SendMessages)), false);
  assert.equal(isStaff(null), false);
});

test('raid alert fires once at the threshold', () => {
  resetRaidState();
  let fired = 0;
  for (let i = 0; i < RAID_JOINS + 5; i += 1) if (trackJoin('g', 1000 + i)) fired += 1;
  assert.equal(fired, 1);
});

test('protect preset covers invites, mentions, floods and new-member links', () => {
  const keys = PROTECT_RULES.map((r) => Object.keys(r.trigger)[0]).sort();
  assert.deepEqual(keys, ['blockInvites', 'flood', 'maxMentions', 'newMemberLinks']);
  const automod = commandData.find((c) => c.name === 'automod');
  assert.ok(automod.options.some((o) => o.name === 'protect'));
  const mod = commandData.find((c) => c.name === 'mod');
  assert.ok(['unban', 'cases'].every((n) => mod.options.some((o) => o.name === n)));
});
