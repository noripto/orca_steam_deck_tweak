import { action } from "@elgato/streamdeck";

import { context } from "../context.js";
import { agentFace } from "./faces.js";
import { StepAction } from "./step-action.js";

@action({ UUID: "dev.orca-ade.streamdeck.next-agent" })
export class NextAgentAction extends StepAction {
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
