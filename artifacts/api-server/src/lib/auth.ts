import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + "cidade-aberta-salt").digest("hex");
}

export function getUserFromCookie(req: Request): { id: number; role: string; name: string } | null {
  try {
    const token = req.signedCookies?.["auth"] || req.cookies?.["auth"];
    if (!token) return null;
    const decoded = Buffer.from(token, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, user: { id: number; role: string; name: string }) {
  const token = Buffer.from(JSON.stringify(user)).toString("base64");
  res.cookie("auth", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("auth");
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userInfo = getUserFromCookie(req);
  if (!userInfo) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).currentUser = userInfo;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userInfo = getUserFromCookie(req);
  if (!userInfo || !["admin", "secretary", "moderator"].includes(userInfo.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).currentUser = userInfo;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const userInfo = getUserFromCookie(req);
  (req as any).currentUser = userInfo;
  next();
}
