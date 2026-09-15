import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { API_VERSION } from "@/lib/constants";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiJson(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("Agent-HQ-API-Version", API_VERSION);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return apiJson(
      {
        error: {
          code: "invalid_request",
          message: "Request validation failed.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }
  if (error instanceof ApiError) {
    return apiJson(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
    const code = String(error.code);
    const message = String(error.message);
    const safeConflictMessages = [
      "task cannot",
      "only failed",
      "only running",
      "only paused",
      "cancellation was not requested",
      "pause was not requested",
      "active lease not found",
      "worker is not registered",
      "task is not active",
    ];
    if (code === "P0001" && safeConflictMessages.some((candidate) => message.includes(candidate))) {
      return apiJson({ error: { code: "state_conflict", message } }, { status: 409 });
    }
    if (code === "23505") {
      return apiJson(
        { error: { code: "conflict", message: "A record with this identity already exists." } },
        { status: 409 },
      );
    }
  }
  console.error("Unhandled Agent HQ API error", error);
  return apiJson(
    { error: { code: "internal_error", message: "The request could not be completed." } },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000)
    throw new ApiError(413, "request_too_large", "Request body is too large.");
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1_000_000) {
      throw new ApiError(413, "request_too_large", "Request body is too large.");
    }
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must contain valid JSON.");
  }
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "missing_token", "A bearer token is required.");
  }
  const token = authorization.slice(7).trim();
  if (token.length < 32 || token.length > 512) {
    throw new ApiError(401, "invalid_token", "The bearer token is invalid.");
  }
  return token;
}
