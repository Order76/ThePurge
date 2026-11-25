import test from 'node:test';
import assert from 'node:assert/strict';
import { joinAlertEmbed, sendJoinAlerts } from '../src/services/joinAlertService.js';

const now = Date.UTC(2026, 10, 25);
test('join alert shows who, account age, invite and status', () => {
  const e = joinAlertEmbed({ guildName: 'Emerald Acres', memberCount: 5, userId: '42', username: 'farmer', createdTimestamp: now - 2 * 86_400_000, inviteCode: 'xvgbVUTJPV', inviteRoleName: 'Member', verification: true }, now).toJSON();
  assert.match(e.description, /<@42> \(\*\*farmer\*\*\) joined \*\*Emerald Acres\*\*/);
  assert.match(e.description, /2 days\*\* ⚠️ new account/);
  assert.match(e.description, /`xvgbVUTJPV` \(Member\)/);
  assert.match(e.description, /waiting to verify/);
  assert.match(e.description, /Members now: \*\*5\*\*/);
});

test('old accounts are not flagged; missing invite is said plainly', () => {
  const e = joinAlertEmbed({ guildName: 'G', userId: '1', username: 'u', createdTimestamp: now - 400 * 86_400_000 }, now).toJSON();
  assert.doesNotMatch(e.description, /new account/);
  assert.match(e.description, /Invite: not detected/);
});

test('every recipient gets a DM, the joiner and bots never do, closed DMs are skipped', async () => {
  const sent = [];
  const users = { a: { send: async () => { sent.push('a'); } }, b: { send: async () => { throw new Error('closed'); } }, j: { send: async () => { sent.push('j'); } } };
  const context = {
    db: { query: async () => ({ rows: [{ config: { userIds: ['11111', '22222', '33333'] } }] }) },
    client: { users: { fetch: async (id) => ({ 11111: users.a, 22222: users.b, 33333: users.j })[id] } },
  };
  const member = { id: '33333', user: { bot: false, username: 'joiner', createdTimestamp: now }, guild: { id: 'g', name: 'G', memberCount: 3 } };
  assert.equal(await sendJoinAlerts(context, member, {}), 1);
  assert.deepEqual(sent, ['a']);
  assert.equal(await sendJoinAlerts(context, { ...member, user: { ...member.user, bot: true } }), 0);
});
