# Orca Agent Control — Elgato Stream Deck plugin

Monitor and control the AI coding agents that [Orca](https://www.onorca.dev/) runs in
parallel (Claude Code, Codex, …) from the physical keys of a Stream Deck.

At a glance you can see how many agents are working, how many are **waiting for you**,
and how many are done — then jump to the one that needs attention, switch agents or
worktrees, and fire a canned prompt, all with one press.

The plugin talks to Orca only through the public `orca` CLI with `--json`. It does not
use the Experimental Plugin API and does not require Orca to expose anything extra.

## Requirements

- Stream Deck software **6.5+** (Windows 10+ / macOS 13+)
- Node.js 20 (bundled by the Stream Deck host; only needed locally for building)
- Orca installed, with the `orca` CLI on `PATH` or auto-detected (see _CLI path_ below)
- Optional but recommended: **Orca agent status hooks enabled**. Without them the plugin
  falls back to the coarser per-worktree status and cannot distinguish `done` from `idle`.

## Install

```bash
pnpm install
pnpm icons     # render PNG key icons from icons-src/*.svg (first time, and after icon edits)
pnpm build     # bundle src/ -> dev.onorca.streamdeck.sdPlugin/bin/plugin.js
pnpm streamdeck link dev.onorca.streamdeck.sdPlugin
pnpm streamdeck restart dev.onorca.streamdeck
```

`link` symlinks the plugin folder into the Stream Deck plugins directory, so a rebuild
plus `restart` is all you need to pick up changes. To produce a distributable bundle:

```bash
pnpm streamdeck pack dev.onorca.streamdeck.sdPlugin
```

## Actions

| Action                       | What the key shows                            | Press                                              |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------- |
| **Orca Status**              | `NEED / WORK / DONE` counts across all agents | Brings Orca to the front                           |
| **Needs Input**              | How many agents are waiting on a human        | Opens the top waiting agent                        |
| **Agent Status**             | One agent's state, type and label             | Opens that agent's terminal                        |
| **Quick Prompt**             | Your button label                             | Sends the configured prompt to the target terminal |
| **Previous / Next Agent**    | —                                             | Moves the shared agent selection                   |
| **Previous / Next Worktree** | —                                             | Moves the shared worktree selection                |
| **Open Agent**               | —                                             | Opens the selected agent's terminal in Orca        |
| **Worktree Selector**        | Selected worktree (repo · branch)             | Opens it. On Stream Deck +, rotate to switch       |

### Key states

Agent state is normalised to five values, and each gets its own glyph _and_ colour so the
keys stay readable without relying on colour alone:

| State       | Glyph   | Meaning                           |
| ----------- | ------- | --------------------------------- |
| `WORKING`   | ● green | The agent is running              |
| `NEEDS YOU` | ! amber | Waiting or blocked on human input |
| `DONE`      | ✓ blue  | Finished its task                 |
| `IDLE`      | ○ grey  | Attached but not running          |
| `UNKNOWN`   | ? grey  | State could not be determined     |

When Orca is not reachable the keys show a banner instead of stale data: `OFFLINE` when
the app or runtime is down, `ERROR` when the CLI returned a failure.

### Multi-agent grid

**Agent Status** has a _Fixed slot_ setting. Leave it blank and the key follows the shared
agent selection; set `0`, `1`, `2`, … on several keys and each one pins to that position in
the agent list, giving you a live grid of every running agent.

### Quick Prompt

Configure a _Button label_ and the _Prompt text_, then pick a target:

- **Active agent** — whatever the shared selection currently points at
- **Specific agent** — pinned to one agent
- **Specific worktree** — pinned to a worktree, resolved to its agent terminal at send time

_Send Enter after prompt_ (on by default) submits the prompt. _Confirm before sending_
requires a second tap, which is worth enabling for anything destructive.

A set of ready-made prompts ships in `src/actions/quick-prompt-model.ts` —
Continue, Run tests, Fix tests, Review changes, Explain changes, Show diff,
Commit changes, Retry.

## Settings

Both settings are global and shared by every key; they appear in the Property Inspector of
any action.

| Setting           | Default | Notes                                                                                                                                                                                                                                           |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI path**      | `auto`  | `auto` probes `$ORCA_CLI_COMMAND`, then the per-platform install location (Windows: `%LOCALAPPDATA%\Programs\orca\resources\bin\orca.exe`; macOS: `/usr/local/bin/orca`, `/opt/homebrew/bin/orca`; Linux: `~/.local/bin/orca-ide`), then `PATH` |
| **Poll interval** | `3` s   | Clamped to 2–10 s. Redraws only when the snapshot actually changes                                                                                                                                                                              |

The Property Inspector also shows a live list of agents and worktrees, so you can confirm
the CLI is reachable and see the slot order before pinning keys.

## Development

```bash
pnpm test           # unit tests (the CLI is mocked)
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint
pnpm format         # oxfmt
pnpm format:check   # oxfmt --check
pnpm build          # rollup bundle
pnpm icons          # regenerate PNG icons from icons-src/*.svg
pnpm watch          # rebuild + restart the plugin on change
pnpm streamdeck validate dev.onorca.streamdeck.sdPlugin
```

### Layout

```
src/orca/       cli.ts (execFile + path detection + error classification), api.ts,
                types.ts, normalize.ts
src/state/      store.ts (snapshot + shared selection), poller.ts (2–10 s, diffed redraw)
src/actions/    base.ts and one file per action, plus Property Inspector plumbing
src/render.ts   key images as SVG data URIs (icon + text)
src/plugin.ts   entry point: register actions, connect, start the poller
dev.onorca.streamdeck.sdPlugin/
                manifest.json and ui/ are source; bin/ and imgs/ are generated
icons-src/ + scripts/render-icons.mjs   SVG -> PNG @1x/@2x via @resvg/resvg-js
tests/          parse / normalize / store / quick-prompt / cli
```

Every CLI invocation goes through `src/orca/cli.ts` and uses `execFile` with an argv array
— never a shell string — so prompt text and worktree paths cannot be interpreted as shell
syntax. `tests/cli.test.ts` asserts that hostile strings stay a single argv element.

## Limitations

- The public CLI exposes no direct mapping from an agent (`paneKey`) to a terminal
  (`handle`). Sending and opening resolve the handle by matching agent type and title
  within the worktree, preferring a connected terminal — best-effort when several agents
  of the same type share a worktree.
- `DONE` vs `IDLE` requires Orca agent status hooks. With hooks off, both collapse into the
  coarser worktree status.
- Stale terminal handles are re-resolved by re-listing the worktree.
