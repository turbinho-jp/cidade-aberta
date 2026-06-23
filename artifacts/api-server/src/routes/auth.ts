import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, setAuthCookie, clearAuthCookie, getUserFromCookie } from "../lib/auth";

const router = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email and password are required" });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      name,
      email,
      passwordHash,
      phone: phone || null,
      role: "citizen",
    }).returning();
    setAuthCookie(res, { id: user.id, role: user.role, name: user.name });
    res.status(201).json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
        demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
        commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
      }
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    setAuthCookie(res, { id: user.id, role: user.role, name: user.name });
    res.json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
        demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
        commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
      }
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const userInfo = getUserFromCookie(req);
    if (!userInfo) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userInfo.id)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
      demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
      commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
