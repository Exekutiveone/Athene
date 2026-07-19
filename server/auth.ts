import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export type AtheneRole = "admin" | "customer";

export function configuredAdminToken(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  return environment.ATHENE_ADMIN_TOKEN || (environment.NODE_ENV === "production" ? undefined : "admin");
}

export function bearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function tokenMatches(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function resolveRole(authorization: string | undefined, adminToken = configuredAdminToken()): AtheneRole {
  return tokenMatches(bearerToken(authorization), adminToken) ? "admin" : "customer";
}

export function requireAdminForMutation(adminToken = configuredAdminToken()): RequestHandler {
  return (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    if (!adminToken) {
      response.status(503).json({ error: "ATHENE_ADMIN_TOKEN ist auf dem Server nicht konfiguriert." });
      return;
    }
    if (resolveRole(request.header("authorization"), adminToken) !== "admin") {
      response.status(403).json({ error: "Diese Aktion erfordert die Admin-Rolle." });
      return;
    }
    next();
  };
}
