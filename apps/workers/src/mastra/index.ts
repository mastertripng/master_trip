import { Mastra } from "@mastra/core";
import { supportAgent } from "../agents/support";

export const mastra: Mastra = new Mastra({
  agents: {
    supportAgent,
  },
});
