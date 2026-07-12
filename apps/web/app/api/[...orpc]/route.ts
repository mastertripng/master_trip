import { NextRequest } from "next/server";
import { serve } from "@orpc/server/next";
import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "@master-trip/api/router";

export const dynamic = "force-dynamic";

const rpcHandler = new RPCHandler(appRouter);
const handler = serve(rpcHandler, { prefix: "/api" });

export async function GET(req: NextRequest) { return handler.GET(req); }
export async function POST(req: NextRequest) { return handler.POST(req); }
export async function PUT(req: NextRequest) { return handler.PUT(req); }
export async function PATCH(req: NextRequest) { return handler.PATCH(req); }
export async function DELETE(req: NextRequest) { return handler.DELETE(req); }

