// Form-based ticket panels: one panel message with a button per ticket kind
// (for example Feedback, Suggestion, Concern, Review). Each button opens a
// Discord modal; the answers open a private ticket channel named <kind>-<n>.
// Pure helpers only (no Discord or database calls) so they can be unit tested.

export const FEEDBACK_KINDS = [
  {
    key: 'feedback',
    label: 'Feedback',
    emoji: '💬',
    style: 'primary',
    fields: [
      { id: 'subject', label: 'Subject', style: 'short', required: true, max: 100, placeholder: 'One line: what is this about?' },
      { id: 'details', label: 'Your feedback', style: 'paragraph', required: true, max: 1500 },
    ],
  },
  {
    key: 'suggestion',
    label: 'Suggestion',
    emoji: '💡',
    style: 'success',
    story: 'Story',
    fields: [
      { id: 'subject', label: 'Your idea in one line', style: 'short', required: true, max: 100 },
      { id: 'details', label: 'Tell us more', style: 'paragraph', required: true, max: 1500 },
    ],
  },
  {
    key: 'concern',
    label: 'Concern',
    emoji: '⚠️',
    style: 'danger',
    story: 'Concern',
    fields: [
      { id: 'subject', label: 'What is the concern?', style: 'short', required: true, max: 100 },
      { id: 'details', label: 'What happened?', style: 'paragraph', required: true, max: 1500, placeholder: 'Steps, where in the game, and your device if it is a bug.' },
    ],
  },
  {
    key: 'review',
    label: 'Review',
    emoji: '⭐',
    style: 'secondary',
    fields: [
      { id: 'rating', label: 'Rating (1 to 5 stars)', style: 'short', required: true, min: 1, max: 1, placeholder: '5', rating: true },
      { id: 'subject', label: 'Headline', style: 'short', required: true, max: 100 },
      { id: 'details', label: 'Your review', style: 'paragraph', required: true, max: 1500 },
    ],
  },
];

const KEY_RE = /^[a-z0-9-]{1,20}$/;

/** The kinds stored in a panel's `questions` column, or [] for a classic one-button panel. */
export function panelKinds(panel) {
  const raw = panel?.questions;
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? safeJson(raw) : []);
  return (Array.isArray(list) ? list : []).filter((kind) => kind && KEY_RE.test(String(kind.key || '')) && Array.isArray(kind.fields) && kind.fields.length > 0);
}

export function findKind(panel, key) {
  return panelKinds(panel).find((kind) => kind.key === key) || null;
}

/** Custom ids: ticket:form:<panelId>:<kind> (button) and ticket:submit:<panelId>:<kind> (modal). */
export function formButtonId(panelId, key) { return `ticket:form:${panelId}:${key}`; }
export function formModalId(panelId, key) { return `ticket:submit:${panelId}:${key}`; }

export function parseTicketCustomId(customId) {
  const [ns, action, id, kind] = String(customId || '').split(':');
  if (ns !== 'ticket' || !action) return null;
  return { action, id: id || null, kind: kind || null };
}

/** Check and tidy modal answers. Returns { ok, answers } or { ok: false, message }. */
export function validateAnswers(kind, raw) {
  const answers = {};
  for (const field of kind.fields) {
    const value = String(raw?.[field.id] ?? '').trim();
    if (field.required && !value) return { ok: false, message: `Please fill in "${field.label}".` };
    if (field.rating) {
      const stars = Number(value.replace(/[^0-9]/g, ''));
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, message: 'The rating must be a whole number from 1 to 5.' };
      answers[field.id] = stars;
      continue;
    }
    answers[field.id] = value.slice(0, field.max || 1500);
  }
  return { ok: true, answers };
}

export function stars(n) {
  const k = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
}

/** Embed fields for the ticket intro and the log message. */
export function answerFields(kind, answers) {
  return kind.fields.map((field) => ({
    name: field.label.slice(0, 256),
    value: field.rating ? `${stars(answers[field.id])} (${answers[field.id]}/5)` : clip(answers[field.id] || '-', 1024),
    inline: Boolean(field.rating),
  }));
}

export function ticketSubject(kind, answers) {
  const head = answers.subject ? `: ${answers.subject}` : '';
  return clip(`${kind.label}${head}`, 200);
}

export function kindChannelName(kind, ticketNumber) {
  return `${kind.key}-${ticketNumber}`.slice(0, 100);
}

/** Kinds with `story` file a backlog story in this forum channel (stored with the panel's kinds). */
export function withStoryForum(kinds, forumId) {
  if (!forumId) return kinds;
  return kinds.map((kind) => (kind.story ? { ...kind, storyForumId: String(forumId) } : kind));
}

/**
 * The backlog story for a ticket: a forum post titled TKT-<id> with the player's answers.
 * `forumTags` is the forum's available_tags ([{ id, name }]); tags that do not exist are skipped.
 */
export function storyPost(kind, answers, { ticketId, reporter, channelId }, forumTags = []) {
  const wanted = [kind.story, 'New', 'P3 Normal'];
  const appliedTags = wanted
    .map((name) => forumTags.find((tag) => tag.name === name)?.id)
    .filter(Boolean)
    .slice(0, 5);
  const fields = [
    { name: 'User story', value: clip(kind.story === 'Concern'
      ? `As a player, I ran into a problem: ${answers.subject || '-'}`
      : `As a player, I want ${answers.subject || '-'}`, 1024) },
    { name: 'Details', value: clip(answers.details || '-', 1024) },
    { name: 'Acceptance criteria', value: '☐ Reproduced or agreed\n☐ Fixed or built\n☐ Tested\n☐ Player told in their ticket' },
    { name: 'Source', value: `Ticket #${ticketId} · <#${channelId}>`, inline: true },
    { name: 'Reporter', value: `<@${reporter}>`, inline: true },
  ];
  return {
    name: clip(`TKT-${ticketId} · ${kind.label}: ${answers.subject || ''}`, 100),
    appliedTags,
    title: clip(`${kind.story}: ${answers.subject || kind.label}`, 256),
    fields,
  };
}

function clip(value, max) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return []; }
}
