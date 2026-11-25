import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const commandData = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create default settings for this server.'),
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get the dashboard link and current bot health.'),
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('DM a one-use server invite to a user by ID or known username.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option
      .setName('target')
      .setDescription('Discord user ID, mention, or username visible to the bot')
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel where the invite should be created')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent media messages from a channel.')
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel to purge')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addStringOption((option) => option
      .setName('media')
      .setDescription('Media type to purge')
      .setRequired(false)
      .addChoices(
        { name: 'All media', value: 'all' },
        { name: 'Attachments', value: 'attachments' },
        { name: 'GIFs', value: 'gifs' },
        { name: 'Stickers', value: 'stickers' },
        { name: 'Emojis', value: 'emojis' },
      ))
    .addIntegerOption((option) => option
      .setName('limit')
      .setDescription('Messages to inspect, maximum 500')
      .setMinValue(1)
      .setMaxValue(500)
      .setRequired(false)),
  new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation actions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((command) => command
      .setName('warn')
      .setDescription('Record a warning.')
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((command) => command
      .setName('timeout')
      .setDescription('Timeout a user.')
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption((option) => option.setName('seconds').setDescription('Duration in seconds').setMinValue(10).setMaxValue(2_419_200).setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((command) => command
      .setName('kick')
      .setDescription('Kick a user.')
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((command) => command
      .setName('ban')
      .setDescription('Ban a user.')
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false))
      .addBooleanOption((option) => option.setName('delete-messages').setDescription('Also delete their messages from the last 24 hours').setRequired(false)))
    .addSubcommand((command) => command
      .setName('unban')
      .setDescription('Lift a ban (paste the user ID).')
      .addUserOption((option) => option.setName('user').setDescription('User or user ID').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand((command) => command
      .setName('cases')
      .setDescription("Show a user's moderation history.")
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))),
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage AutoMod rules.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((command) => command
      .setName('protect')
      .setDescription('Switch on the recommended set: outside invites, mention spam, floods, new-member links.'))
    .addSubcommand((command) => command
      .setName('status')
      .setDescription('List the AutoMod rules that are on.'))
    .addSubcommand((command) => command
      .setName('block-invites')
      .setDescription('Create or update the invite-blocking rule.')
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable rule').setRequired(true)))
    .addSubcommand((command) => command
      .setName('block-word')
      .setDescription('Add a blocked word rule.')
      .addStringOption((option) => option.setName('word').setDescription('Word or phrase').setRequired(true))),
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Manage audit log channel.')
    .addSubcommand((command) => command
      .setName('set-channel')
      .setDescription('Set the channel for moderation logs.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Log channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand((command) => command
      .setName('recent')
      .setDescription('Show recent audit events.')),
  new SlashCommandBuilder()
    .setName('custom-command')
    .setDescription('Manage custom commands.')
    .addSubcommand((command) => command
      .setName('set')
      .setDescription('Create or update a custom command.')
      .addStringOption((option) => option.setName('name').setDescription('Command name').setRequired(true))
      .addStringOption((option) => option.setName('response').setDescription('Response template').setRequired(true)))
    .addSubcommand((command) => command
      .setName('delete')
      .setDescription('Delete a custom command.')
      .addStringOption((option) => option.setName('name').setDescription('Command name').setRequired(true)))
    .addSubcommand((command) => command
      .setName('list')
      .setDescription('List custom commands.')),
  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome and leave messages.')
    .addSubcommand((command) => command
      .setName('set')
      .setDescription('Set the welcome channel and message.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Welcome channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption((option) => option.setName('message').setDescription('Template message').setRequired(true))),
  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage automatic role assignment.')
    .addSubcommand((command) => command
      .setName('join-role')
      .setDescription('Set the role assigned to new members.')
      .addRoleOption((option) => option.setName('role').setDescription('Role').setRequired(true))),
  new SlashCommandBuilder()
    .setName('inviterole')
    .setDescription('Permanent invite links that give a role to whoever joins through them.')
    .addSubcommand((command) => command
      .setName('create-all')
      .setDescription('Make one permanent invite per role (staff-power roles need approval on join).')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel new members land in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand((command) => command
      .setName('list')
      .setDescription('Show the role invite links.')),
  new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage scheduled jobs.')
    .addSubcommand((command) => command
      .setName('message')
      .setDescription('Schedule a recurring message.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Target channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption((option) => option.setName('message').setDescription('Message template').setRequired(true))
      .addIntegerOption((option) => option.setName('interval-seconds').setDescription('Interval in seconds').setMinValue(60).setRequired(true)))
    .addSubcommand((command) => command
      .setName('purge')
      .setDescription('Schedule recurring media purges.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Target channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addIntegerOption((option) => option
        .setName('interval-seconds')
        .setDescription('Interval in seconds')
        .setMinValue(60)
        .setRequired(true))
      .addStringOption((option) => option
        .setName('media')
        .setDescription('Media type to purge')
        .setRequired(false)
        .addChoices(
          { name: 'All media', value: 'all' },
          { name: 'Attachments', value: 'attachments' },
          { name: 'GIFs', value: 'gifs' },
          { name: 'Stickers', value: 'stickers' },
          { name: 'Emojis', value: 'emojis' },
        ))
      .addIntegerOption((option) => option
        .setName('limit')
        .setDescription('Messages to inspect, maximum 500')
        .setMinValue(1)
        .setMaxValue(500)
        .setRequired(false)))
    .addSubcommand((command) => command
      .setName('list')
      .setDescription('List active jobs.')),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your server rank.'),
  new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy commands.')
    .addSubcommand((command) => command
      .setName('balance')
      .setDescription('Show your balance.')),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticketing control.')
    .addSubcommand((command) => command
      .setName('quicksetup')
      .setDescription('Create a ticket panel with staff and log routing.')
      .addChannelOption((option) => option
        .setName('panel-channel')
        .setDescription('Channel where the ticket panel is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption((option) => option
        .setName('staff-role')
        .setDescription('Role that can see and answer tickets')
        .setRequired(true))
      .addChannelOption((option) => option
        .setName('log-channel')
        .setDescription('Channel for ticket and moderation logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
      .addChannelOption((option) => option
        .setName('category')
        .setDescription('Category where ticket channels are created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)))
    .addSubcommand((command) => command
      .setName('panel')
      .setDescription('Post a ticket panel.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel where the ticket panel is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption((option) => option
        .setName('title')
        .setDescription('Panel title')
        .setRequired(false))
      .addStringOption((option) => option
        .setName('description')
        .setDescription('Panel description')
        .setRequired(false))
      .addStringOption((option) => option
        .setName('button-label')
        .setDescription('Open button label')
        .setRequired(false)))
    .addSubcommand((command) => command
      .setName('feedbackpanel')
      .setDescription('Post a Feedback / Suggestion / Concern / Review panel with short forms.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel where the panel is posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption((option) => option
        .setName('staff-role')
        .setDescription('Role that can see and answer the tickets')
        .setRequired(true))
      .addChannelOption((option) => option
        .setName('log-channel')
        .setDescription('Staff channel where new and closed tickets are logged')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
      .addChannelOption((option) => option
        .setName('category')
        .setDescription('Category where ticket channels are created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false))
      .addChannelOption((option) => option
        .setName('backlog')
        .setDescription('Forum where Concern and Suggestion tickets are filed as backlog stories')
        .addChannelTypes(ChannelType.GuildForum)
        .setRequired(false))
      .addStringOption((option) => option
        .setName('title')
        .setDescription('Panel title (default: Feedback & Reviews)')
        .setRequired(false))
      .addStringOption((option) => option
        .setName('description')
        .setDescription('Panel text')
        .setRequired(false)))
    .addSubcommand((command) => command
      .setName('claim')
      .setDescription('Claim the current ticket.'))
    .addSubcommand((command) => command
      .setName('close')
      .setDescription('Close the current ticket and store a transcript.')
      .addStringOption((option) => option
        .setName('reason')
        .setDescription('Close reason')
        .setRequired(false))),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Human verification for new members.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((command) => command
      .setName('setup')
      .setDescription('Post the Verify panel and hold back the role until people pass.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel for the Verify panel (everyone must be able to see it)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption((option) => option
        .setName('role')
        .setDescription('Role given after passing (the role that lets people talk, e.g. Member)')
        .setRequired(true))
      .addChannelOption((option) => option
        .setName('log-channel')
        .setDescription('Staff channel for joins, failures and approvals (default: ticket/server log)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
      .addIntegerOption((option) => option
        .setName('min-account-age-days')
        .setDescription('Accounts younger than this go to staff for approval (0 = off)')
        .setMinValue(0)
        .setMaxValue(365)
        .setRequired(false)))
    .addSubcommand((command) => command
      .setName('approve')
      .setDescription('Verify someone by hand.')
      .addUserOption((option) => option.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((command) => command
      .setName('off')
      .setDescription('Switch verification off (new members get the join role straight away).')),
  new SlashCommandBuilder()
    .setName('joinalerts')
    .setDescription('Get a DM from the bot every time someone joins.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((command) => command
      .setName('on')
      .setDescription('Send join DMs to you (or another staff member).')
      .addUserOption((option) => option.setName('user').setDescription('Who gets the DMs (default: you)').setRequired(false)))
    .addSubcommand((command) => command
      .setName('off')
      .setDescription('Stop join DMs for you (or another staff member).')
      .addUserOption((option) => option.setName('user').setDescription('Who to stop (default: you)').setRequired(false)))
    .addSubcommand((command) => command
      .setName('list')
      .setDescription('Who gets join DMs.')),
].map((command) => command.toJSON());
