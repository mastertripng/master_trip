import { publicProcedure } from "../procedures";
import { TourSearchInputSchema } from "@master-trip/types/tour";

export const tourRouter = {
  search: publicProcedure
    .input(TourSearchInputSchema)
    .handler(async ({ input }) => {
      // TODO: LocalNigerianToursAdapter — MVP prioritizes local footprint
      console.log("Searching tours for:", input);
      return { results: [], cached: false };
    }),
};
