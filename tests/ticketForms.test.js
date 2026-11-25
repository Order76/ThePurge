import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonStyle } from 'discord.js';
import {
  FEEDBACK_KINDS,
  answerFields,
  findKind,
  formButtonId,
  formModalId,
  kindChannelName,
  panelKinds,
  parseTicketCustomId,
  stars,
  storyPost,
  withStoryForum,
  ticketSubject,
  validateAnswers,
} from '../src/services/ticketForms.js';
import { buildTicketModal, openFormTicket, panelComponents } from '../src/services/ticketService.js';
import { commandData } from '../src/bot/commands.js';

const formPanel = { id: '7', title: 'Feedback & Reviews', color: '#2e7d32', questions: FEEDBACK_KINDS, staff_role_ids: ['900'] };

test('feedback kinds are feedback, suggestion, concern and review', () => {
  assert.deepEqual(FEEDBACK_KINDS.map((kind) => kind.key), ['feedback', 'suggestion', 'concern', 'review']);
  for (const kind of FEEDBACK_KINDS) assert.ok(kind.fields.length >= 1 && kind.fields.length <= 5);
});

test('classic panels have no kinds and keep one Open Ticket button', () => {
  assert.deepEqual(panelKinds({ questions: [] }), []);
  assert.deepEqual(panelKinds({ questions: '[]' }), []);
  assert.deepEqual(panelKinds({}), []);
  const rows = panelComponents({ id: 3, button_label: 'Help', questions: [] }).map((row) => row.toJSON());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].components.length, 1);
  assert.equal(rows[0].components[0].custom_id, 'ticket:open:3');
});

test('form panels get one button per kind', () => {
  const rows = panelComponents(formPanel).map((row) => row.toJSON());
  const buttons = rows.flatMap((row) => row.components);
  assert.deepEqual(buttons.map((b) => b.custom_id), ['ticket:form:7:feedback', 'ticket:form:7:suggestion', 'ticket:form:7:concern', 'ticket:form:7:review']);
  assert.equal(buttons[2].style, ButtonStyle.Danger);
});

test('kinds with unsafe keys are ignored', () => {
  assert.deepEqual(panelKinds({ questions: [{ key: 'Bad Key', fields: [{ id: 'x' }] }, { key: 'ok', fields: [] }] }), []);
});

test('custom ids round-trip', () => {
  assert.deepEqual(parseTicketCustomId(formButtonId(7, 'review')), { action: 'form', id: '7', kind: 'review' });
  assert.deepEqual(parseTicketCustomId(formModalId(7, 'review')), { action: 'submit', id: '7', kind: 'review' });
  assert.deepEqual(parseTicketCustomId('ticket:close:12'), { action: 'close', id: '12', kind: null });
  assert.equal(parseTicketCustomId('other:x'), null);
});

test('review rating must be 1 to 5', () => {
  const review = findKind(formPanel, 'review');
  assert.equal(validateAnswers(review, { rating: '0', subject: 'a', details: 'b' }).ok, false);
  assert.equal(validateAnswers(review, { rating: '6', subject: 'a', details: 'b' }).ok, false);
  assert.equal(validateAnswers(review, { rating: 'x', subject: 'a', details: 'b' }).ok, false);
  const ok = validateAnswers(review, { rating: ' 4 ', subject: ' Fun ', details: 'Loved the horse' });
  assert.deepEqual(ok, { ok: true, answers: { rating: 4, subject: 'Fun', details: 'Loved the horse' } });
  assert.equal(stars(4), '★★★★☆');
  assert.equal(answerFields(review, ok.answers)[0].value, '★★★★☆ (4/5)');
});

test('required fields are enforced', () => {
  const feedback = findKind(formPanel, 'feedback');
  const result = validateAnswers(feedback, { subject: '  ', details: 'x' });
  assert.equal(result.ok, false);
  assert.match(result.message, /Subject/);
});

test('subject and channel name come from the kind', () => {
  const concern = findKind(formPanel, 'concern');
  assert.equal(ticketSubject(concern, { subject: 'Crash at the lake' }), 'Concern: Crash at the lake');
  assert.equal(kindChannelName(concern, 12), 'concern-12');
});

test('modal has one input per field with the submit custom id', () => {
  const modal = buildTicketModal(formPanel, findKind(formPanel, 'review')).toJSON();
  assert.equal(modal.custom_id, 'ticket:submit:7:review');
  assert.equal(modal.title, 'Review');
  assert.deepEqual(modal.components.map((row) => row.components[0].custom_id), ['rating', 'subject', 'details']);
});

test('ticket command has the feedbackpanel subcommand', () => {
  const ticket = commandData.find((command) => command.name === 'ticket');
  assert.deepEqual(ticket.options.map((option) => option.name).sort(), ['claim', 'close', 'feedbackpanel', 'panel', 'quicksetup']);
});

function fakeContext({ existing = false, logChannelId = '555', panel = formPanel } = {}) {
  const queries = [];
  const sent = { ticket: [], log: [] };
  const created = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM ticket_panels')) return { rowCount: 1, rows: [panel] };
      if (sql.includes("status = 'open'") && sql.includes('form_responses')) return existing ? { rowCount: 1, rows: [{ id: 1, channel_id: '111' }] } : { rowCount: 0, rows: [] };
      if (sql.includes('COUNT(*)')) return { rowCount: 1, rows: [{ count: 11 }] };
      if (sql.includes('INSERT INTO tickets')) return { rowCount: 1, rows: [{ id: 42 }] };
      if (sql.includes('log_channel_id')) return { rowCount: 1, rows: [{ channel_id: logChannelId }] };
      return { rowCount: 0, rows: [] };
    },
  };
  const ticketChannel = { id: '222', toString: () => '<#222>', send: async (m) => { sent.ticket.push(m); } };
  const logChannel = { id: '555', isTextBased: () => true, send: async (m) => { sent.log.push(m); } };
  const stories = [];
  const forum = {
    id: '777',
    availableTags: [{ id: 't1', name: 'Concern' }, { id: 't2', name: 'Story' }, { id: 't3', name: 'New' }, { id: 't4', name: 'P3 Normal' }],
    threads: { create: async (opts) => { stories.push(opts); return { id: '888' }; } },
  };
  const guild = {
    id: 'g1',
    roles: { everyone: { id: 'g1' } },
    channels: {
      create: async (opts) => { created.push(opts); return ticketChannel; },
      fetch: async (id) => (id === '555' ? logChannel : id === '777' ? forum : null),
    },
  };
  const context = { db, client: { user: { id: 'bot' } }, audit: { record: async () => {} } };
  return { context, guild, queries, sent, created, stories };
}

function fakeModal(guild, values) {
  return {
    guild,
    user: { id: 'u1', username: 'Tester', toString: () => '<@u1>' },
    fields: { getTextInputValue: (id) => values[id] },
  };
}

test('submitting a review opens review-<n>, stores answers and logs it', async () => {
  const { context, guild, queries, sent, created } = fakeContext();
  const result = await openFormTicket(context, fakeModal(guild, { rating: '5', subject: 'Great', details: 'Love it' }), '7', 'review');
  assert.equal(result.ok, true);
  assert.match(result.message, /review is in <#222>/);
  assert.equal(created[0].name, 'review-12');
  assert.ok(created[0].permissionOverwrites.some((o) => o.id === '900'));
  const insert = queries.find((q) => q.sql.includes('INSERT INTO tickets'));
  assert.equal(insert.params[4], 'Review: Great');
  assert.deepEqual(JSON.parse(insert.params[5]), { kind: 'review', rating: 5, subject: 'Great', details: 'Love it' });
  assert.equal(sent.ticket.length, 1);
  assert.equal(sent.log.length, 1);
  assert.match(sent.log[0].embeds[0].toJSON().title, /Review #42 opened/);
});

test('a bad rating opens nothing', async () => {
  const { context, guild, created } = fakeContext();
  const result = await openFormTicket(context, fakeModal(guild, { rating: '9', subject: 'x', details: 'y' }), '7', 'review');
  assert.equal(result.ok, false);
  assert.equal(created.length, 0);
});

test('one open ticket per kind per person', async () => {
  const { context, guild, created } = fakeContext({ existing: true });
  const result = await openFormTicket(context, fakeModal(guild, { subject: 'x', details: 'y' }), '7', 'feedback');
  assert.match(result.message, /already have an open feedback ticket: <#111>/);
  assert.equal(created.length, 0);
});

test('unknown kind is refused', async () => {
  const { context, guild } = fakeContext();
  const result = await openFormTicket(context, fakeModal(guild, {}), '7', 'nope');
  assert.equal(result.ok, false);
});

test('concern and suggestion file backlog stories; feedback and review do not', () => {
  const kinds = withStoryForum(FEEDBACK_KINDS, '777');
  assert.deepEqual(kinds.filter((k) => k.storyForumId === '777').map((k) => k.key), ['suggestion', 'concern']);
  assert.equal(withStoryForum(FEEDBACK_KINDS, null), FEEDBACK_KINDS);
});

test('story post is titled TKT-<id> and tagged by type, New and P3', () => {
  const concern = findKind(formPanel, 'concern');
  const tagsAvail = [{ id: 'a', name: 'Concern' }, { id: 'b', name: 'New' }, { id: 'c', name: 'P3 Normal' }];
  const story = storyPost(concern, { subject: 'Stuck on the pier', details: 'Boat will not launch' }, { ticketId: 9, reporter: 'u1', channelId: '222' }, tagsAvail);
  assert.equal(story.name, 'TKT-9 · Concern: Stuck on the pier');
  assert.deepEqual(story.appliedTags, ['a', 'b', 'c']);
  assert.match(story.fields.find((f) => f.name === 'Source').value, /Ticket #9 · <#222>/);
});

test('a concern ticket on a panel with a backlog forum files one story', async () => {
  const panel = { ...formPanel, questions: withStoryForum(FEEDBACK_KINDS, '777') };
  const { context, guild, stories } = fakeContext({ panel });
  const result = await openFormTicket(context, fakeModal(guild, { subject: 'Crash at the lake', details: 'On my phone' }), '7', 'concern');
  assert.equal(result.ok, true);
  assert.equal(stories.length, 1);
  assert.equal(stories[0].name, 'TKT-42 · Concern: Crash at the lake');
  assert.deepEqual(stories[0].appliedTags, ['t1', 't3', 't4']);
});

test('a review ticket files no story', async () => {
  const panel = { ...formPanel, questions: withStoryForum(FEEDBACK_KINDS, '777') };
  const { context, guild, stories } = fakeContext({ panel });
  await openFormTicket(context, fakeModal(guild, { rating: '5', subject: 'Great', details: 'Yes' }), '7', 'review');
  assert.equal(stories.length, 0);
});
