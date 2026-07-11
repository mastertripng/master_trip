import { NextResponse } from "next/server";
import { openAPI } from "@master-trip/api";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const spec = await openAPI;
  return NextResponse.json(spec);
}
