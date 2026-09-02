import { context } from "../context.js";
import { ACTION_UUID } from "../uuid.js";
import { worktreeFace } from "./faces.js";
import { StepAction } from "./step-action.js";

export class NextWorktreeAction extends StepAction {
  override readonly manifestId = ACTION_UUID.nextWorktree;

  constructor() {
    super(
      "▶",
      () => {
        context.store.stepWorktree(1);
      },
      worktreeFace
    );
  }
}
