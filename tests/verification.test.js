import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONS_PER_CHALLENGE, PICTURES, accountAgeDays, makeChallenge, needsStaffReview, parseVerifyId, pickId,
  handleVerifyButton, resetVerificationState,
} from '../src/services/verificationService.js';
import { commandData } from '../src/bot/commands.js';

test('a challenge has eight different options including the answer', () => {
  for (let i = 0; i < 200; i += 1) {
    const c = makeChallenge();
    assert.equal(c.options.length, OPTIONS_PER_CHALLENGE);
    assert.equal(new Set(c.options).size, OPTIONS_PER_CHALLENGE);
    assert.ok(c.options.includes(c.answer));
    assert.ok(c.options.every((i2) => i2 >= 0 && i2 < PICTURES.length));
    assert.match(c.nonce, /^[0-9a-f]{12}$/);
  }
});

test('the answer is not always in the same place', () => {
  const spots = new Set();
  for (let i = 0; i < 200; i += 1) { const c = makeChallenge(); spots.add(c.options.indexOf(c.answer)); }
  assert.ok(spots.size >= 6);
});

test('verify button ids round-trip and junk is rejected', () => {
  assert.deepEqual(parseVerifyId('verify:start'), { action: 'start' });
  assert.deepEqual(parseVerifyId(pickId('abcdef012345', 7)), { action: 'pick', nonce: 'abcdef012345', index: 7 });
  assert.deepEqual(parseVerifyId('verify:approve:123456789012345678'), { action: 'approve', userId: '123456789012345678' });
  assert.equal(parseVerifyId('verify:pick:zz:1'), null);
  assert.equal(parseVerifyId('verify:approve:abc'), null);
  assert.equal(parseVerifyId('ticket:open:1'), null);
});

test('account age and staff review threshold', () => {
  const now = Date.UTC(2026, 10, 25);
  const day = 86_400_000;
  assert.equal(accountAgeDays(now - 3.5 * day, now), 3);
  assert.equal(needsStaffReview(now - 2 * day, 7, now), true);
  assert.equal(needsStaffReview(now - 10 * day, 7, now), false);
  assert.equal(needsStaffReview(now - 1000, 0, now), false);
});

function fakeInteraction(customId, { roles = [], db } = {}) {
  const calls = { reply: [], update: [], rolesAdded: [] };
  const member = {
    id: 'u1', user: { id: 'u1', createdTimestamp: Date.now() - 400 * 86_400_000 },
    roles: { cache: new Map(roles.map((r) => [r, true])), add: async (r) => { calls.rolesAdded.push(r); } },
    guild: null,
  };
  const guild = {
    id: 'g1', roles: { cache: new Map(), fetch: async () => null }, channels: { fetch: async () => null },
    members: { fetch: async () => member },
  };
  member.guild = guild;
  return {
    calls,
    interaction: {
      customId, guild, member, user: member.user,
      reply: async (p) => { calls.reply.push(p); }, update: async (p) => { calls.update.push(p); },
    },
    db,
  };
}

function fakeDb(config) {
  return { query: async (sql) => {
    if (sql.includes('FROM module_settings')) return { rowCount: 1, rows: [{ enabled: true, config }] };
    if (sql.includes('UPDATE verification_pending')) return { rowCount: 0, rows: [] };
    return { rowCount: 0, rows: [] };
  } };
}

test('pass on the right picture gives the role; three wrong picks start a cooldown', async () => {
  resetVerificationState();
  const db = fakeDb({ roleId: 'member', minAccountAgeDays: 0 });
  const ctx = { db, audit: { record: async () => {} } };

  const start = fakeInteraction('verify:start', { db });
  await handleVerifyButton(ctx, start.interaction);
  const prompt = start.calls.reply[0];
  assert.match(prompt.content, /^Tap the \*\*\w+\*\*\.$/);
  const name = prompt.content.match(/\*\*(\w+)\*\*/)[1];
  const ids = prompt.components.flatMap((row) => row.components.map((b) => b.data.custom_id));
  const right = ids.find((id) => PICTURES[Number(id.split(':')[3])].name === name);
  const wrong = ids.find((id) => id !== right);

  const ok = fakeInteraction(right, { db });
  await handleVerifyButton(ctx, ok.interaction);
  assert.deepEqual(ok.calls.rolesAdded, ['member']);
  assert.match(ok.calls.update[0].content, /Welcome/);

  // fresh challenge, then three wrong picks
  resetVerificationState();
  let s = fakeInteraction('verify:start', { db });
  await handleVerifyButton(ctx, s.interaction);
  let msg = s.calls.reply[0];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const n = msg.content.match(/\*\*(\w+)\*\*/)[1];
    const bad = msg.components.flatMap((row) => row.components.map((b) => b.data.custom_id))
      .find((id) => PICTURES[Number(id.split(':')[3])].name !== n);
    const w = fakeInteraction(bad, { db });
    await handleVerifyButton(ctx, w.interaction);
    assert.equal(w.calls.rolesAdded.length, 0);
    msg = w.calls.update[0];
  }
  assert.match(msg.content, /10 minutes/);
  const again = fakeInteraction('verify:start', { db });
  await handleVerifyButton(ctx, again.interaction);
  assert.match(again.calls.reply[0].content, /Try again/);
  assert.ok(wrong);
});

test('members who already have the role are told so', async () => {
  resetVerificationState();
  const db = fakeDb({ roleId: 'member' });
  const f = fakeInteraction('verify:start', { roles: ['member'], db });
  await handleVerifyButton({ db, audit: { record: async () => {} } }, f.interaction);
  assert.match(f.calls.reply[0].content, /already verified/);
});

test('verify command is staff-only and has setup, approve and off', () => {
  const cmd = commandData.find((c) => c.name === 'verify');
  assert.ok(cmd.default_member_permissions);
  assert.deepEqual(cmd.options.map((o) => o.name).sort(), ['approve', 'off', 'setup']);
});
