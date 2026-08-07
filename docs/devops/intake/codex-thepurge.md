# ThePurge Intake State Report - codex-thepurge

Filed: 2026-08-07

Repo: `https://github.com/Puettse/ThePurge.git`

Local source path used: `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main`

Report branch: `codex/thepurge-intake-state-report`

## 1.  What I was asked to do (verbatim if you have it)

Original ThePurge scope was provided across several prompts. Key verbatim requests I acted on:

> "C:\Users\sethp\Desktop\ThePurge-main" will act as a repository for archives of a versions of my app.

> the railway project lives here
> https://railway.com/project/de811de9-a54f-4a31-8185-505903795b64
> ensure the live network feed is active and all logs are active and established.

> Analyze these bot structures and archiatecture.

> Determine Which Functions and Feature you are able to reproduce without excissive functionallity duplication in order to build a solid all in on bot.

> PLEASE IMPLEMENT THIS PLAN:
> # ThePurge All-In-One Bot Feature Selection Plan

> ALSO; MISSION CRITICAL; prepare implementation of ticketing control :
> https://ticketking.xyz/dashboard
> https://ticketking.xyz/docs

> Just fo what ever is necessary but make sure everything remains modular and scalable and keep going till its done.

> Critical requirement: ZERO FAIL INTEGRATION.  NO FUNCTION OR FEATURE NESD BE RELIANT ON ANOTHER MODULE TO SUCH A DEGREE THAT SHOULD ONE MODULE GO DOWN, ANOTHER GOES DOWN.  THEY MUST BE ABLE TO BE SCALED INDEPENDENTLY AND MODIFIED INDEPENDENTLY

Later repair/export prompts I acted on:

> dashboard is not loading

> n src/db/index.js, add an idempotent migration that renames the purge_configs column from media_types to media_type at startup.

> Step 1: Identify all file locations you have worked from
> Step 2: Build a SQL migration map for these to be cloned into a central location with the claude system?
> Step 3:Send the sql database here "C:\Users\sethp\Desktop\Codex Export"

## 2.  What I actually changed — table: file | change | committed? | pushed?

| file | change | committed? | pushed? |
|---|---|---:|---:|
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\index.js` | Replaced original entry with modular `src/main.js` startup. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\main.js` | Added modular startup, dashboard server, DB migration, Discord client, scheduler, shutdown handling; later changed startup so dashboard binds before DB/Discord and reports degraded dependency status. | yes, `c68dbd5`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\config.js` | Added env loading for bot/dashboard/Railway; later allowed partial config for degraded dashboard startup. | yes, `c68dbd5`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\db\index.js` | Added central PostgreSQL schema/migration setup, `ensureGuild`, module defaults, purge config unique index/dedupe, legacy scheduled purge migration, and legacy `media_types` to `media_type` rename block. | yes, `c68dbd5`, `355b475`, `bf24ed3` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\commands.js` | Added slash command registry for setup/dashboard/purge/mod/automod/logs/custom-command/welcome/autorole/schedule/rank/economy/ticket; later added `/schedule purge`. | yes, `c68dbd5`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\events.js` | Added Discord event wiring and later isolated event feature failures. | yes, `c68dbd5`, `774a41b` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\interactions.js` | Added central interaction router with command/button boundaries. | yes, `c68dbd5`, `774a41b` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\*.js` | Added lazy-loaded Discord feature handlers for setup, moderation, automation, logs, engagement, tickets, and utilities. | yes, `774a41b`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\*.js` | Added audit, automod, live feed, media purge, moderation, permission, scheduler, template, and ticket services. Extracted `mediaService` so scheduled/manual purge share logic. | yes, `c68dbd5`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\*.js` | Added Express dashboard, OAuth helper, API actions, and static app serving. | yes, `c68dbd5`, `774a41b`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\*.js` | Added core/guild/health routes, lazy module routers, and dashboard section isolation. | yes, `774a41b`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\index.html` | Added dashboard UI shell. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\app.js` | Added dashboard client logic for health, guilds, modules, settings, commands, automod, scheduler, tickets, and live feed. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\styles.css` | Added dashboard styling. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\railway.json` | Added Railway config-as-code with start command, health check, and restart policy. | yes, `ebd9b74` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.github\workflows\ci.yml` | Added Node CI checks. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.github\workflows\autoversion.yml` | Removed old auto-version workflow in favor of CI/version discipline. | yes, `c68dbd5` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\package.json` | Changed package to modular all-in-one bot, added deps/scripts; version reached `4.3.1` in my last pushed change. Later commit `41a0e78` may have changed package again; not mine. | yes, `c68dbd5`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\package-lock.json` | Lockfile updated for package changes. | yes, `c68dbd5`, `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\README.md` | Updated docs for modular architecture, Railway, dashboard, isolation rules. | yes, `c68dbd5`, `774a41b`, `ebd9b74`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\CHANGELOG.md` | Added release notes through `4.3.1`. | yes, multiple commits through `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\CODEMAP.md` | Added/updated architecture map. | yes, `c68dbd5`, `774a41b`, `ebd9b74`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\VERSION.json` | Updated version metadata through `4.3.1`. | yes, multiple commits through `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\docs\code-reviews\*.md` | Added code review notes for all-in-one build, isolation, Railway config, and purge fail report closure. | yes, `c68dbd5`, `774a41b`, `ebd9b74`, `355b475` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\*.js` | Added tests for command registry, isolation, live feed, media purge, template engine, and degraded dashboard health. | yes, through `579ec42` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\remoteControlService.js` | Observed in current repo at `41a0e78`; not my authored work. | yes, `41a0e78` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\remoteOps.js` | Observed in current repo at `41a0e78`; not my authored work. | yes, `41a0e78` | yes, `main` |
| `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\docs\devops\intake\codex-thepurge.md` | This state report. | yes, this branch after commit | yes, this branch after push |

## 3.  Work that is NOT pushed — uncommitted, stashed, session-only.

MOST IMPORTANT SECTION.

- `C:\Users\sethp\Desktop\Codex Export\thepurge_database.sql` exists outside the repo. It is not committed or pushed anywhere by me.
- `C:\Users\sethp\Desktop\Codex Export\THEPURGE_SQL_MIGRATION_MAP.md` exists outside the repo. It is not committed or pushed anywhere by me.
- `C:\Users\sethp\Desktop\Codex Export\THEPURGE_WORKED_LOCATIONS.md` exists outside the repo. It is not committed or pushed anywhere by me.
- `C:\Users\sethp\Desktop\Codex Export\CLAUDE_THEPURGE_SQL_HANDOFF.md` exists outside the repo. It is not committed or pushed anywhere by me.
- `C:\Users\sethp\Desktop\Codex Export\thepurge_export_manifest.json` exists outside the repo. It is not committed or pushed anywhere by me.
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.codex-run\dashboard.out.log` and `.codex-run\dashboard.err.log` were transient local logs from dashboard debugging. They are not committed or pushed.
- I have no known uncommitted or stashed ThePurge source changes before filing this report. Evidence before report branch work: `git status --short --branch` returned `## main...origin/main`.

## 4.  Code running in production that is NOT in git — full paths + host

UNVERIFIED.

I did not have authenticated Railway access and did not inspect the live Railway filesystem. I know the user-provided Railway project URL only:

- `https://railway.com/project/de811de9-a54f-4a31-8185-505903795b64`

I do not know of any ThePurge production code path outside git. I did not observe the production service filesystem.

## 5.  What is broken, and how I know — symptom + evidence (log line, HTTP code, run id)

| symptom | evidence |
|---|---|
| Local dashboard originally did not load at `http://localhost:3000/`. | Browser showed Chrome error page `This site can't be reached` / `ERR_CONNECTION_REFUSED`; shell `Invoke-WebRequest http://localhost:3000/health` returned `Unable to connect to the remote server`; `Get-NetTCPConnection -LocalPort 3000` returned no listener. |
| Local app lacked runtime credentials. | `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main` had `.env.example` only; no `.env` was present when checked. Required names in `src/config.js`: `BOT_TOKEN`, `DATABASE_URL`, `CLIENT_ID`. |
| Local dashboard after fix still reported degraded health without env. This is expected degraded behavior, not proof of full bot operation. | `Invoke-WebRequest http://localhost:3000/api/health` returned HTTP `200` with JSON beginning `{"ok":false,"bot":{"ready":false,"user":null,"guildCount":0,...`. |
| Railway live deployment state is unknown. | Railway CLI was unavailable for verified deployment inspection in my session: prior check reported unauthorized. I did not observe a successful Railway deploy, runtime log stream, or live callback. |
| Current HEAD `41a0e78 Add remote operations control panel` is not personally verified by me. | It appeared in local history after my last pushed migration work. I used it as observed source context for the SQL export but did not run its production flow. |
| The actual production database schema and data are unknown. | No `DATABASE_URL` value was available locally and no authenticated Railway DB connection was used. The export I made is schema/migration only, not a production dump. |

## 6.  What I believe works — WITH PROOF. How verified, when. Else UNVERIFIED.

| item | status | proof |
|---|---|---|
| Local syntax/tests through my last pushed fix before `41a0e78`. | verified locally at that time | `npm.cmd run check` at version `4.3.1` returned `13 passed, 0 failed` after the dashboard degraded-startup fix. |
| Idempotent `purge_configs.media_types` to `media_type` startup migration. | verified by test suite only, not against production DB | After adding the block in `src/db/index.js`, `npm.cmd run check` returned `13 passed, 0 failed`; no live DB migration run was observed. |
| Local dashboard static page can be served in degraded mode. | verified locally at that time | After `579ec42`, `Invoke-WebRequest http://localhost:3000/` returned HTTP `200` with title `ThePurge Control Panel`; browser snapshot showed `ThePurge Control Panel` and status `Bot starting | Guilds 0 | OAuth not configured`. |
| GitHub CI after `355b475`. | verified at that time | GitHub Actions URL observed earlier: `https://github.com/Puettse/ThePurge/actions/runs/28344732419`, 12/12 tests passed. I did not re-check CI for later commits in this intake task. |
| Railway production deployment. | UNVERIFIED | No authenticated Railway inspection and no live HTTP domain test by me. |
| Discord bot login, command registration, moderation, scheduler, ticketing, OAuth, remote ops in a real Discord server. | UNVERIFIED | No observed successful live Discord workflow in my session. |
| Production database migration on Railway. | UNVERIFIED | No observed Railway DB connection/migration run by me. |
| Current `41a0e78` remote operations feature. | UNVERIFIED | Not authored or functionally tested by me. |

## 7.  Config and secrets — NAMES AND LOCATIONS ONLY

No secret values are included here.

Config names from `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.env.example` and `src/config.js`:

- `BOT_TOKEN`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `SESSION_SECRET`
- `PORT`
- `NODE_ENV`
- `RAILWAY_PUBLIC_DOMAIN`

Known config locations:

- Local example only: `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.env.example`
- Local real env: `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\.env` was not present when I checked.
- Railway project page provided by user: `https://railway.com/project/de811de9-a54f-4a31-8185-505903795b64`
- Discord OAuth callback expected shape: `<PUBLIC_BASE_URL>/auth/callback`

## 8.  Decisions made, and why (a decision without a reason gets undone)

| decision | reason |
|---|---|
| Keep all database DDL and migrations centralized in `src/db/index.js`. | Prevent feature modules from owning hidden schema and reduce drift for central orchestration. |
| Use lazy-loaded Discord command handlers under `src/bot/handlers/`. | A failing feature import should not take down unrelated commands. |
| Use lazy-loaded dashboard module routers under `src/web/routes/modules/`. | A failing dashboard module should return a module-scoped error instead of breaking all dashboard APIs. |
| Add shared `mediaService` for purge matching/deletion. | Avoid duplicating purge logic across manual purge and scheduler. |
| Start the Express dashboard before DB and Discord are fully initialized. | Satisfies fail-isolation requirement and gives `/health` visibility when bot/database/config are broken. |
| Report health as degraded instead of crashing when required env is missing. | Enables Railway/local visibility and avoids hiding missing config behind `ERR_CONNECTION_REFUSED`. |
| Suppress mass mentions by default in templates/custom commands. | Avoid unsafe custom command behavior and accidental broad pings. |
| Do not implement music in v1. | High maintenance/external infra/API churn and low overlap with ThePurge purge/moderation goal. |
| Keep ticketing as service + dashboard/Discord surface, not a separate bot subsystem with its own persistence path. | Ticketing needs audit/log/config reuse and should not create an isolated architecture island. |
| Exported SQL to `C:\Users\sethp\Desktop\Codex Export` outside git when asked. | User explicitly requested that path; no instruction was given then to commit the export. |

## 9.  Things that bit me — traps, footguns, wasted hours

- Initial local source folder was not a normal git checkout; I initialized/attached it to `https://github.com/Puettse/ThePurge.git` earlier in the work.
- NPM certificate validation failed until using `NODE_OPTIONS=--use-system-ca`.
- Railway CLI was not authenticated, so production deploy/log verification could not be done from my session.
- Dashboard was originally coupled to successful config, DB, Discord command registration, and Discord login. Result: local `ERR_CONNECTION_REFUSED` instead of useful degraded status.
- The old purge fail report was for commit `1307669`; current repo moved far beyond that. It is easy to compare against stale line numbers.
- `purge_configs.media_types` versus `media_type` legacy schema mismatch required an idempotent startup migration before any `media_type` reference.
- A later commit `41a0e78 Add remote operations control panel` existed when I exported SQL, but I did not author or verify it. Do not assign my proof claims to that feature.
- `C:\Users\sethp\Desktop\Codex Export` contains important export artifacts outside git. They are easy to miss or overwrite.

## 10. What I was in the middle of (so it isn't assigned twice)

Nothing active beyond filing this intake report.

Previous completed but not production-verified handoff work:

- SQL schema/migration export was written to `C:\Users\sethp\Desktop\Codex Export`.
- Claude handoff prompt was written to `C:\Users\sethp\Desktop\Codex Export\CLAUDE_THEPURGE_SQL_HANDOFF.md`.
- Local dashboard degraded startup fix was committed and pushed on `main`.
- `media_types` to `media_type` migration was committed and pushed on `main`.

## 11. Files I consider mine right now — exact paths, for AOR boundaries

Files I authored or materially reshaped and would consider part of my AOR unless reassigned:

- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\db\index.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\main.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\config.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\commands.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\events.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\interactions.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\registerCommands.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\automation.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\engagement.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\index.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\logs.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\moderation.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\setup.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\tickets.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\bot\handlers\utils.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\auditService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\automodService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\liveFeed.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\mediaService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\moderationService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\permissionService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\scheduler.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\schedulerTasks.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\templateEngine.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\ticketService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\auth.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\server.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\webActions.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\core.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\guilds.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\health.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\routeUtils.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\automation.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\moderation.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\overview.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\settings.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\tickets.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\index.html`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\app.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\public\styles.css`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\commands.test.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\dashboardHealth.test.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\isolation.test.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\liveFeed.test.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\moderationService.test.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\templateEngine.test.js`

Files I observed but do not claim as mine:

- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\services\remoteControlService.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\src\web\routes\modules\remoteOps.js`
- `C:\Users\sethp\Desktop\ThePurge-main\ThePurge-main\tests\remoteControlService.test.js`

Export artifacts outside git that should be preserved or explicitly rehomed:

- `C:\Users\sethp\Desktop\Codex Export\thepurge_database.sql`
- `C:\Users\sethp\Desktop\Codex Export\THEPURGE_SQL_MIGRATION_MAP.md`
- `C:\Users\sethp\Desktop\Codex Export\THEPURGE_WORKED_LOCATIONS.md`
- `C:\Users\sethp\Desktop\Codex Export\CLAUDE_THEPURGE_SQL_HANDOFF.md`
- `C:\Users\sethp\Desktop\Codex Export\thepurge_export_manifest.json`

## 12. Open questions I could not resolve

- What is the actual Railway public domain for ThePurge?
- Is Railway connected to `Puettse/ThePurge` `main`, and did it deploy commits after `bf24ed3` or `41a0e78`?
- Do Railway variables exist for `BOT_TOKEN`, `DATABASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `PUBLIC_BASE_URL`, `SESSION_SECRET`, and optional `RAILWAY_PUBLIC_DOMAIN`?
- Did the production database ever have `purge_configs.media_types`, and has the rename migration run there?
- Is `41a0e78 Add remote operations control panel` owned by another agent, and was it tested in production?
- Should the `C:\Users\sethp\Desktop\Codex Export` artifacts be committed into this repo, moved into a central ops repo, or deleted after ingestion?
- Does the Discord application OAuth callback exactly match the Railway public URL plus `/auth/callback`?
- Has any live Discord server completed a full workflow for setup, dashboard login, ticket panel creation, ticket open/close, scheduled purge, or moderation action? I did not observe any of these.
