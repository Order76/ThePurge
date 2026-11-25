import { isModuleEnabled } from '../../db/index.js';
import { hasModerationPermission } from '../../services/permissionService.js';
import { purgeChannelMessages, runModerationAction } from '../../services/moderationService.js';

export async function handlePurge(context, interaction) {
  if (!(await isModuleEnabled(context.db, interaction.guild.id, 'moderation'))) {
    await interaction.reply({ content: 'Moderation module is disabled.', ephemeral: true });
    return;
  }

  if (!hasModerationPermission(interaction.member)) {
    await interaction.reply({ content: 'A moderation permission is required.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel', true);
  const mediaType = interaction.options.getString('media') || 'all';
  const limit = interaction.options.getInteger('limit') || 100;
  const result = await purgeChannelMessages(context, { interaction, channel, mediaType, limit });

  const failureText = result.failedCount > 0 ? ` ${result.failedCount} deletes failed.` : '';
  await interaction.editReply(
    `Inspected ${result.inspectedCount} messages, matched ${result.matchedCount}, and deleted ${result.deletedCount}.${failureText}`,
  );
}

export async function handleMod(context, interaction) {
  if (!(await isModuleEnabled(context.db, interaction.guild.id, 'moderation'))) {
    await interaction.reply({ content: 'Moderation module is disabled.', ephemeral: true });
    return;
  }

  const action = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user', true);

  if (action === 'cases') {
    if (!hasModerationPermission(interaction.member)) {
      await interaction.reply({ content: 'A moderation permission is required.', ephemeral: true });
      return;
    }
    const { formatCases, listCases } = await import('../../services/moderationService.js');
    const rows = await listCases(context.db, interaction.guild.id, targetUser.id);
    await interaction.reply({ content: `Cases for ${targetUser}:\n${formatCases(rows)}`.slice(0, 1990), ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }

  const reason = interaction.options.getString('reason') || 'No reason provided.';
  const durationSeconds = interaction.options.getInteger('seconds');
  const result = await runModerationAction(context, {
    interaction,
    action,
    targetUser,
    reason,
    durationSeconds,
    deleteMessages: interaction.options.getBoolean('delete-messages') || false,
  });

  await interaction.reply({ content: result.message, ephemeral: true });
}
