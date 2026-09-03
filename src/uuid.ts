/**
 * Action identifiers, kept in sync with `src/assets/manifest.json` by
 * `tests/manifest.test.ts`.
 *
 * These are assigned to `SingletonAction.manifestId` rather than applied with
 * the SDK's `@action` decorator: the decorator is a standard (TC39 stage 3)
 * decorator, and oxc — which Rolldown/tsdown use to transform — cannot lower
 * those yet, so they would reach Node verbatim and fail to parse.
 */
export const PLUGIN_UUID = "norigram.orca-ade.streamdeck";

export const ACTION_UUID = {
  agentStatus: `${PLUGIN_UUID}.agent-status`,
  needsInput: `${PLUGIN_UUID}.needs-input`,
  nextAgent: `${PLUGIN_UUID}.next-agent`,
  nextWorktree: `${PLUGIN_UUID}.next-worktree`,
  openAgent: `${PLUGIN_UUID}.open-agent`,
  orcaStatus: `${PLUGIN_UUID}.orca-status`,
  prevAgent: `${PLUGIN_UUID}.prev-agent`,
  prevWorktree: `${PLUGIN_UUID}.prev-worktree`,
  quickPrompt: `${PLUGIN_UUID}.quick-prompt`,
  worktreeStatus: `${PLUGIN_UUID}.worktree-status`,
} as const;
