import { NextResponse } from "next/server";
import { openAPI } from "@master-trip/api/openapi";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(openAPI);
}

