import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { approvalIds, findUsedInvite, handleInviteRoleJoin, isPrivilegedRole, linkableRoles, parseApprovalId } from '../src/services/inviteRoleService.js';
import { commandData } from '../src/bot/commands.js';

const perms = (...names) => ({ permissions: { bitfield: names.reduce((a, n) => a | PermissionFlagsBits[n], 0n) } });

test('roles with staff powers need approval; plain roles do not', () => {
  assert.equal(isPrivilegedRole(perms('ViewChannel', 'SendMessages', 'UseEmbeddedActivities')), false);
  assert.equal(isPrivilegedRole(perms()), false);
  assert.equal(isPrivilegedRole(perms('SendMessages', 'KickMembers')), true);
  assert.equal(isPrivilegedRole(perms('ManageMessages')), true);
  assert.equal(isPrivilegedRole(perms('MentionEveryone')), true);
  assert.equal(isPrivilegedRole(perms('Administrator')), true);
});

test('the used invite is the one whose count went up; ties give no answer', () => {
  const before = new Map([['aaa', 3], ['bbb', 0]]);
  assert.equal(findUsedInvite(before, [{ code: 'aaa', uses: 3 }, { code: 'bbb', uses: 1 }]), 'bbb');
  assert.equal(findUsedInvite(before, [{ code: 'aaa', uses: 3 }, { code: 'bbb', uses: 0 }, { code: 'new', uses: 1 }]), 'new');
  assert.equal(findUsedInvite(before, [{ code: 'aaa', uses: 4 }, { code: 'bbb', uses: 1 }]), null);
  assert.equal(findUsedInvite(before, [{ code: 'aaa', uses: 3 }]), null);
});

test('linkable roles skip @everyone, bot-managed roles and roles at or above the bot', () => {
  const roles = [
    { id: 'g', position: 0, managed: false, name: '@everyone' },
    { id: 'a', position: 1, managed: false, name: 'Member' },
    { id: 'b', position: 2, managed: true, name: 'SomeBot' },
    { id: 'c', position: 5, managed: false, name: 'Above' },
    { id: 'd', position: 3, managed: false, name: 'Staff' },
  ];
  const guild = { id: 'g', roles: { cache: new Map(roles.map((r) => [r.id, r])) } };
  assert.deepEqual(linkableRoles(guild, 5).map((r) => r.name), ['Staff', 'Member']);
});

test('approval button ids round-trip and reject junk', () => {
  const ids = approvalIds('123456789', '987654321');
  assert.deepEqual(parseApprovalId(ids.approve), { action: 'approve', userId: '123456789', roleId: '987654321' });
  assert.equal(parseApprovalId('inviterole:grant:1:2'), null);
  assert.equal(parseApprovalId('ticket:approve:123456:123456'), null);
});

function fakeGuild({ roles, invitesSeq }) {
  let call = 0; const added = []; const sent = [];
  const guild = {
    id: 'g1',
    roles: { cache: new Map(roles.map((r) => [r.id, r])), fetch: async () => null },
    invites: { fetch: async () => new Map(invitesSeq[Math.min(call++, invitesSeq.length - 1)].map((i) => [i.code, i])) },
    channels: { fetch: async () => ({ isTextBased: () => true, send: async (m) => sent.push(m) }) },
  };
  const member = { id: 'u1', guild, toString: () => '<@u1>', roles: { add: async (role) => added.push(role.id) } };
  return { guild, member, added, sent };
}
const db = (links) => ({ query: async () => ({ rowCount: 1, rows: [{ config: { links } }] }) });

test('joining with a plain role link gives the role', async () => {
  const { member, added } = fakeGuild({ roles: [{ id: 'r1', name: 'Tester', ...perms('ViewChannel') }], invitesSeq: [[{ code: 'tst', uses: 0 }], [{ code: 'tst', uses: 1 }]] });
  const { refreshInviteCache } = await import('../src/services/inviteRoleService.js');
  await refreshInviteCache(member.guild);
  const result = await handleInviteRoleJoin({ db: db({ tst: { roleId: 'r1' } }) }, member, {});
  assert.deepEqual(result, { given: 'r1', code: 'tst' });
  assert.deepEqual(added, ['r1']);
});

test('joining with a staff link asks for approval and gives nothing', async () => {
  const { member, added, sent } = fakeGuild({ roles: [{ id: 'r2', name: 'Staff', ...perms('KickMembers') }], invitesSeq: [[{ code: 'stf', uses: 2 }], [{ code: 'stf', uses: 3 }]] });
  const { refreshInviteCache } = await import('../src/services/inviteRoleService.js');
  await refreshInviteCache(member.guild);
  const result = await handleInviteRoleJoin({ db: db({ stf: { roleId: 'r2' } }) }, member, { logChannelId: '555' });
  assert.deepEqual(result, { pending: 'r2', code: 'stf' });
  assert.deepEqual(added, []);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].components[0].toJSON().components[0].custom_id, 'inviterole:approve:u1:r2');
});

test('inviterole command has create-all and list', () => {
  const cmd = commandData.find((c) => c.name === 'inviterole');
  assert.deepEqual(cmd.options.map((o) => o.name).sort(), ['create-all', 'list']);
});
