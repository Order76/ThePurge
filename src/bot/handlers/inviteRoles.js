import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { createRoleInvites, getLogChannelId, isPrivilegedRole, loadLinks } from '../../services/inviteRoleService.js';

export async function handleInviteRole(context, interaction) {
  if (!interaction.member?.permissions?.has?.(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'Manage Server permission is required.', ephemeral: true });
    return;
  }
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create-all') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('channel', true);
    const items = await createRoleInvites(context, interaction.guild, channel, interaction.user);
    const lines = items.map((item) => `**${item.role.name}**${item.approval ? ' (needs approval)' : ''}: ${item.url}${item.created ? '' : ' (kept)'}`);
    const embed = new EmbedBuilder().setTitle('Role invite links').setDescription(lines.join('\n') || 'No roles to link.').setColor(0x2e7d32).setTimestamp(new Date());
    const logId = await getLogChannelId(context.db, interaction.guild.id);
    const log = logId ? await interaction.guild.channels.fetch(logId).catch(() => null) : null;
    if (log?.isTextBased?.()) await log.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await context.audit?.record?.({ guildId: interaction.guild.id, actorId: interaction.user.id, action: 'inviterole.created', source: 'discord', details: { count: items.length } });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (subcommand === 'list') {
    const links = await loadLinks(context.db, interaction.guild.id);
    const lines = Object.entries(links).map(([code, link]) => {
      const role = interaction.guild.roles.cache.get(link.roleId);
      return `**${role?.name || link.label}**${role && isPrivilegedRole(role) ? ' (needs approval)' : ''}: https://discord.gg/${code}`;
    });
    await interaction.reply({ content: lines.join('\n') || 'No role invite links yet. Use /inviterole create-all.', ephemeral: true });
  }
}
