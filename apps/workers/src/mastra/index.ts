import { Mastra } from "@mastra/core";
import { fulfillmentAgent } from "../agents/fulfillment";
import { supportAgent } from "../agents/support";

export const mastra: Mastra = new Mastra({
  agents: {
    fulfillmentAgent,
    supportAgent,
  },
});
