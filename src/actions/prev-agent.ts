import { action } from "@elgato/streamdeck";

import { context } from "../context.js";
import { agentFace } from "./faces.js";
import { StepAction } from "./step-action.js";

@action({ UUID: "dev.onorca.streamdeck.prev-agent" })
export class PrevAgentAction extends StepAction {
  constructor() {
    super(
      "◀",
      () => {
        context.store.stepAgent(-1);
      },
      agentFace
    );
  }
}
