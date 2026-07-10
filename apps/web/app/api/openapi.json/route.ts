import { NextResponse } from "next/server";
import { openAPI } from "@master-trip/api";

export async function GET(): Promise<Response> {
  const spec = await openAPI;
  return NextResponse.json(spec);
}
