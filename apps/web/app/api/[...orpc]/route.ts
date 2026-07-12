import { serve } from "@orpc/server/next";
import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "@master-trip/api/router";

export const dynamic = "force-dynamic";

const rpcHandler = new RPCHandler(appRouter);
export const { GET, POST, PUT, PATCH, DELETE } = serve(rpcHandler, { prefix: "/api" });

