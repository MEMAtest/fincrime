import { NextResponse } from "next/server";

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function tooManyRequests(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Generic message on login failure - never reveals whether the email exists. */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";
