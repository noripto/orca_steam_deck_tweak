import { streamDeck } from "@elgato/streamdeck";

/**
 * Shared scoped logger. The Stream Deck host runs the plugin as a child
 * process, so `console` output goes nowhere a user can find; these entries
 * land in `dev.orca-ade.streamdeck.sdPlugin/logs/` instead.
 */
export const logger = streamDeck.logger.createScope("orca");
