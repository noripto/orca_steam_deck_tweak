import { action } from "@elgato/streamdeck";

import { context } from "../context.js";
import { worktreeFace } from "./faces.js";
import { StepAction } from "./step-action.js";

@action({ UUID: "dev.onorca.streamdeck.prev-worktree" })
export class PrevWorktreeAction extends StepAction {
  constructor() {
    super(
      "◀",
      () => {
        context.store.stepWorktree(-1);
      },
      worktreeFace
    );
  }
}
