import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  answerFields,
  findKind,
  formButtonId,
  formModalId,
  kindChannelName,
  panelKinds,
  ticketSubject,
  validateAnswers,
} from './ticketForms.js';

export async function createTicketPanel(context, guild, options) {
  const staffRoleIds = normalizeRoleIds(options.staffRoleIds || []);
  const result = await context.db.query(
    `
    INSERT INTO ticket_panels (
      guild_id, channel_id, title, description, button_label, button_emoji,
      category_id, staff_role_ids, questions, color, enabled, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
    RETURNING *;
    `,
    [
      guild.id,
      options.channelId || null,
      options.title || 'Open a Support Ticket',
      options.description || 'Click the button below to open a private support ticket.',
      options.buttonLabel || 'Open Ticket',
      options.buttonEmoji || null,
      options.categoryId || null,
      staffRoleIds,
      JSON.stringify(options.questions || []),
      options.color || '#b71c1c',
    ],
  );

  const panel = result.rows[0];
  if (options.channelId) {
    await publishTicketPanel(context, guild, panel);
  }

  await context.audit.record({
    guildId: guild.id,
    actorId: options.actorId || null,
    targetId: options.channelId || null,
    action: 'tickets.panel_created',
    source: options.source || 'dashboard',
    details: { panelId: panel.id, title: panel.title },
  });

  return panel;
}

export async function publishTicketPanel(context, guild, panel) {
  const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    throw new Error('Ticket panel channel was not found or is not text-based.');
  }

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(parseColor(panel.color));

  const message = await channel.send({
    embeds: [embed],
    components: panelComponents(panel),
  });

  await context.db.query(
    'UPDATE ticket_panels SET message_id = $2, updated_at = NOW() WHERE id = $1',
    [panel.id, message.id],
  );

  return message;
}

export async function openTicketFromPanel(context, interaction, panelId) {
  const panel = await getActivePanel(context, interaction.guild.id, panelId);
  if (!panel) return { ok: false, message: 'This ticket panel is no longer active.' };
  return openTicket(context, interaction, panel, null, null);
}

/** Button on a form panel: show that kind's modal. Must be the first response to the interaction. */
export async function showTicketForm(context, interaction, panelId, kindKey) {
  const panel = await getActivePanel(context, interaction.guild.id, panelId);
  const kind = panel ? findKind(panel, kindKey) : null;
  if (!kind) {
    await interaction.reply({ content: 'This ticket panel is no longer active.', ephemeral: true });
    return;
  }
  await interaction.showModal(buildTicketModal(panel, kind));
}

/** Modal submitted: validate the answers and open the ticket. */
export async function openFormTicket(context, interaction, panelId, kindKey) {
  const panel = await getActivePanel(context, interaction.guild.id, panelId);
  const kind = panel ? findKind(panel, kindKey) : null;
  if (!kind) return { ok: false, message: 'This ticket panel is no longer active.' };

  const raw = {};
  for (const field of kind.fields) raw[field.id] = interaction.fields.getTextInputValue(field.id) ?? '';
  const checked = validateAnswers(kind, raw);
  if (!checked.ok) return checked;

  return openTicket(context, interaction, panel, kind, checked.answers);
}

export function buildTicketModal(panel, kind) {
  const modal = new ModalBuilder()
    .setCustomId(formModalId(panel.id, kind.key))
    .setTitle(`${kind.label}`.slice(0, 45));
  for (const field of kind.fields.slice(0, 5)) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label.slice(0, 45))
      .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(Boolean(field.required))
      .setMaxLength(field.max || 1500);
    if (field.min) input.setMinLength(field.min);
    if (field.placeholder) input.setPlaceholder(field.placeholder.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

export function panelComponents(panel) {
  const kinds = panelKinds(panel);
  if (kinds.length === 0) {
    const button = new ButtonBuilder()
      .setCustomId(`ticket:open:${panel.id}`)
      .setLabel(panel.button_label || 'Open Ticket')
      .setStyle(ButtonStyle.Primary);
    if (panel.button_emoji) button.setEmoji(panel.button_emoji);
    return [new ActionRowBuilder().addComponents(button)];
  }

  const rows = [];
  for (let i = 0; i < Math.min(kinds.length, 25); i += 5) {
    rows.push(new ActionRowBuilder().addComponents(kinds.slice(i, i + 5).map((kind) => {
      const button = new ButtonBuilder()
        .setCustomId(formButtonId(panel.id, kind.key))
        .setLabel(kind.label.slice(0, 80))
        .setStyle(BUTTON_STYLES[kind.style] || ButtonStyle.Primary);
      if (kind.emoji) button.setEmoji(kind.emoji);
      return button;
    })));
  }
  return rows;
}

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

async function getActivePanel(context, guildId, panelId) {
  if (!/^[0-9]+$/.test(String(panelId || ''))) return null;
  const result = await context.db.query(
    'SELECT * FROM ticket_panels WHERE id = $1 AND guild_id = $2 AND enabled = TRUE',
    [panelId, guildId],
  );
  return result.rows[0] || null;
}

async function openTicket(context, interaction, panel, kind, answers) {
  const existing = await context.db.query(
    `
    SELECT id, channel_id
    FROM tickets
    WHERE guild_id = $1
      AND panel_id = $2
      AND opener_id = $3
      AND status = 'open'
      AND COALESCE(form_responses->>'kind', '') = $4
    ORDER BY opened_at DESC
    LIMIT 1;
    `,
    [interaction.guild.id, panel.id, interaction.user.id, kind?.key || ''],
  );

  if (existing.rowCount > 0) {
    const what = kind ? `${kind.label.toLowerCase()} ticket` : 'ticket';
    return { ok: true, message: `You already have an open ${what}: <#${existing.rows[0].channel_id}>.` };
  }

  const ticketNumber = await nextTicketNumber(context, interaction.guild.id);
  const channelName = kind
    ? kindChannelName(kind, ticketNumber)
    : `ticket-${ticketNumber}-${safeChannelName(interaction.user.username)}`;
  const channel = await createTicketChannel(context, interaction.guild, panel, interaction.user, channelName);
  const subject = kind ? ticketSubject(kind, answers) : panel.title;
  const formResponses = kind ? { kind: kind.key, ...answers } : {};

  const ticket = await context.db.query(
    `
    INSERT INTO tickets (guild_id, panel_id, channel_id, opener_id, subject, form_responses)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
    `,
    [interaction.guild.id, panel.id, channel.id, interaction.user.id, subject, JSON.stringify(formResponses)],
  );

  await sendTicketIntro(channel, ticket.rows[0], panel, interaction.user, kind, answers);
  // Only form tickets post to the log channel, so classic panels behave exactly as before.
  if (kind) await postTicketLog(context, interaction.guild, {
    title: `${kind ? kind.label : 'Ticket'} #${ticket.rows[0].id} opened`,
    description: `${interaction.user} opened ${channel}.`,
    fields: kind ? answerFields(kind, answers) : [],
    color: panel.color,
  });

  await context.audit.record({
    guildId: interaction.guild.id,
    actorId: interaction.user.id,
    targetId: channel.id,
    action: 'tickets.opened',
    source: 'discord',
    details: { panelId: panel.id, ticketId: ticket.rows[0].id, kind: kind?.key || null },
  });

  return {
    ok: true,
    message: kind ? `Thanks! Your ${kind.label.toLowerCase()} is in ${channel}. The team can reply to you there.` : `Ticket opened: ${channel}.`,
  };
}

/** Post to the ticket log channel (tickets module config, else the server log channel). Never throws. */
async function postTicketLog(context, guild, { title, description, fields = [], color }) {
  try {
    const result = await context.db.query(
      `
      SELECT COALESCE(m.config->>'logChannelId', g.log_channel_id) AS channel_id
      FROM guild_settings g
      LEFT JOIN module_settings m ON m.guild_id = g.guild_id AND m.module_name = 'tickets'
      WHERE g.guild_id = $1;
      `,
      [guild.id],
    );
    const channelId = result.rows[0]?.channel_id;
    if (!channelId) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder().setTitle(title.slice(0, 256)).setDescription(description).setColor(parseColor(color)).setTimestamp(new Date());
    if (fields.length) embed.addFields(fields.slice(0, 25));
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('[tickets] Log post failed', error);
  }
}

export async function claimTicket(context, interaction) {
  const ticket = await getOpenTicketByChannel(context, interaction.guild.id, interaction.channel.id);
  if (!ticket) return { ok: false, message: 'This channel is not an open ticket.' };

  await context.db.query(
    `
    UPDATE tickets
    SET claimed_by = $2, claimed_at = NOW()
    WHERE id = $1;
    `,
    [ticket.id, interaction.user.id],
  );

  await context.audit.record({
    guildId: interaction.guild.id,
    actorId: interaction.user.id,
    targetId: interaction.channel.id,
    action: 'tickets.claimed',
    source: 'discord',
    details: { ticketId: ticket.id },
  });

  return { ok: true, message: `Ticket claimed by ${interaction.user}.` };
}

export async function closeTicket(context, interaction, reason = 'No reason provided.') {
  const ticket = await getOpenTicketByChannel(context, interaction.guild.id, interaction.channel.id);
  if (!ticket) return { ok: false, message: 'This channel is not an open ticket.' };

  const transcript = await buildTranscript(interaction.channel);
  await context.db.query(
    `
    INSERT INTO ticket_transcripts (ticket_id, guild_id, channel_id, message_count, transcript)
    VALUES ($1, $2, $3, $4, $5);
    `,
    [ticket.id, interaction.guild.id, interaction.channel.id, transcript.length, JSON.stringify(transcript)],
  );

  await context.db.query(
    `
    UPDATE tickets
    SET status = 'closed',
        closed_at = NOW(),
        closed_by = $2,
        close_reason = $3
    WHERE id = $1;
    `,
    [ticket.id, interaction.user.id, reason],
  );

  await lockTicketChannel(interaction.channel, ticket.opener_id);
  if (ticket.form_responses?.kind) {
    await postTicketLog(context, interaction.guild, {
      title: `Ticket #${ticket.id} closed`,
      description: `${ticket.subject || 'Ticket'}\nClosed by ${interaction.user}: ${reason}\nTranscript: ${transcript.length} messages stored.`,
    });
  }

  await context.audit.record({
    guildId: interaction.guild.id,
    actorId: interaction.user.id,
    targetId: interaction.channel.id,
    action: 'tickets.closed',
    source: 'discord',
    details: { ticketId: ticket.id, reason, messageCount: transcript.length },
  });

  return { ok: true, message: `Ticket #${ticket.id} closed. Transcript stored in the dashboard database.` };
}

export async function closeTicketFromDashboard(context, guild, actorId, ticketId, reason = 'Closed from dashboard') {
  const result = await context.db.query(
    'SELECT * FROM tickets WHERE id = $1 AND guild_id = $2 AND status = $3',
    [ticketId, guild.id, 'open'],
  );
  if (result.rowCount === 0) return { ok: false, message: 'Open ticket was not found.' };

  const ticket = result.rows[0];
  const channel = await guild.channels.fetch(ticket.channel_id).catch(() => null);
  let transcript = [];

  if (channel?.isTextBased()) {
    transcript = await buildTranscript(channel);
    await lockTicketChannel(channel, ticket.opener_id);
  }

  await context.db.query(
    'INSERT INTO ticket_transcripts (ticket_id, guild_id, channel_id, message_count, transcript) VALUES ($1, $2, $3, $4, $5)',
    [ticket.id, guild.id, ticket.channel_id, transcript.length, JSON.stringify(transcript)],
  );
  await context.db.query(
    'UPDATE tickets SET status = $2, closed_at = NOW(), closed_by = $3, close_reason = $4 WHERE id = $1',
    [ticket.id, 'closed', actorId, reason],
  );
  if (ticket.form_responses?.kind) {
    await postTicketLog(context, guild, {
      title: `Ticket #${ticket.id} closed`,
      description: `${ticket.subject || 'Ticket'}\nClosed from the dashboard: ${reason}\nTranscript: ${transcript.length} messages stored.`,
    });
  }

  await context.audit.record({
    guildId: guild.id,
    actorId,
    targetId: ticket.channel_id,
    action: 'tickets.closed',
    source: 'dashboard',
    details: { ticketId: ticket.id, reason },
  });

  return { ok: true, message: `Ticket #${ticket.id} closed.` };
}

async function createTicketChannel(context, guild, panel, user, channelName) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: context.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  for (const roleId of panel.staff_role_ids || []) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  return guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: panel.category_id || null,
    topic: `ThePurge ticket for ${user.tag || user.username} (${user.id})`,
    permissionOverwrites: overwrites,
    reason: 'ThePurge ticket opened',
  });
}

async function sendTicketIntro(channel, ticket, panel, user, kind = null, answers = null) {
  const embed = new EmbedBuilder()
    .setTitle(kind ? `${kind.label} #${ticket.id}` : `Ticket #${ticket.id}`)
    .setDescription(kind
      ? 'Thanks for writing in. Only you and the team can see this channel; add screenshots or more detail here any time.'
      : 'Support staff can claim this ticket. Close it when the issue is resolved.')
    .addFields(
      { name: 'Opened by', value: `${user}`, inline: true },
      { name: 'Panel', value: panel.title, inline: true },
    )
    .setColor(parseColor(panel.color));
  if (kind) embed.addFields(answerFields(kind, answers));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticket.id}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticket.id}`)
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({ content: `${user}`, embeds: [embed], components: [row] });
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  return [...messages.values()]
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => ({
      id: message.id,
      authorId: message.author?.id || null,
      authorTag: message.author?.tag || null,
      content: message.content || '',
      attachmentUrls: [...message.attachments.values()].map((attachment) => attachment.url),
      createdAt: message.createdAt.toISOString(),
    }));
}

async function lockTicketChannel(channel, openerId) {
  await channel.permissionOverwrites.edit(openerId, {
    SendMessages: false,
    ViewChannel: true,
    ReadMessageHistory: true,
  }).catch(() => null);

  await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => null);
}

async function getOpenTicketByChannel(context, guildId, channelId) {
  const result = await context.db.query(
    'SELECT * FROM tickets WHERE guild_id = $1 AND channel_id = $2 AND status = $3 ORDER BY opened_at DESC LIMIT 1',
    [guildId, channelId, 'open'],
  );
  return result.rows[0] || null;
}

async function nextTicketNumber(context, guildId) {
  const result = await context.db.query('SELECT COUNT(*)::int AS count FROM tickets WHERE guild_id = $1', [guildId]);
  return Number(result.rows[0]?.count || 0) + 1;
}

function parseColor(value) {
  const cleaned = String(value || '#b71c1c').replace('#', '');
  return Number.parseInt(cleaned, 16);
}

function safeChannelName(value) {
  return String(value || 'user').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 24);
}

function normalizeRoleIds(roleIds) {
  if (!Array.isArray(roleIds)) return [];
  return roleIds.map(String).filter(Boolean);
}
