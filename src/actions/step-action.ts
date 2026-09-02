import type { KeyDownEvent, WillAppearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { context } from "../context.js";
import type { OrcaSnapshot } from "../orca/types.js";
import { renderConnectionKey, renderKey } from "../render.js";
import { OrcaAction } from "./base.js";
import type { FaceFactory } from "./faces.js";

/**
 * Shared behaviour for the four selector keys. What each key does is passed in
 * rather than overridden, so the concrete actions carry no methods of their own.
 */
export abstract class StepAction extends OrcaAction {
  private readonly arrow: string;
  private readonly step: () => void;
  private readonly face: FaceFactory;

  constructor(arrow: string, step: () => void, face: FaceFactory) {
    super();
    this.arrow = arrow;
    this.step = step;
    this.face = face;
  }

  protected render(
    key: WillAppearEvent<JsonObject>["action"],
    snapshot: OrcaSnapshot
  ): void {
    void key.setTitle("");
    if (snapshot.connection !== "online") {
      void key.setImage(renderConnectionKey(snapshot.connection, "SELECT"));
      return;
    }
    void key.setImage(renderKey(this.face(this.arrow)));
  }

  override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
    this.step();
    this.renderAll(context.store.getSnapshot());
    await ev.action.showOk();
  }
}
