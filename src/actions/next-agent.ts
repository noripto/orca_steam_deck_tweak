import { context } from "../context.js";
import { ACTION_UUID } from "../uuid.js";
import { agentFace } from "./faces.js";
import { StepAction } from "./step-action.js";

export class NextAgentAction extends StepAction {
  override readonly manifestId = ACTION_UUID.nextAgent;

  constructor() {
    super(
      "▶",
      () => {
        context.store.stepAgent(1);
      },
      agentFace
    );
  }
}
