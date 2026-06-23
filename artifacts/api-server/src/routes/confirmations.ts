import { Router } from "express";
import { db, confirmationsTable, demandsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router = Router();

router.post("/demands/:id/confirm", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.id);
    const currentUser = (req as any).currentUser;
    const existing = await db.select().from(confirmationsTable)
      .where(and(eq(confirmationsTable.demandId, demandId), eq(confirmationsTable.userId, currentUser.id))).limit(1);
    if (existing.length > 0) {
      const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
      res.json({ confirmed: true, total: demand?.confirmationsCount ?? 0 });
      return;
    }
    await db.insert(confirmationsTable).values({ demandId, userId: currentUser.id });
    const [demand] = await db.update(demandsTable)
      .set({ confirmationsCount: sql`${demandsTable.confirmationsCount} + 1` })
      .where(eq(demandsTable.id, demandId)).returning();
    await Promise.all([
      db.update(usersTable).set({ confirmationsCount: sql`${usersTable.confirmationsCount} + 1`, points: sql`${usersTable.points} + 3` }).where(eq(usersTable.id, currentUser.id)),
      logActivity({ type: "confirmation_added", description: `Nova confirmação em: ${demand?.title}`, demandId, demandTitle: demand?.title, actorName: currentUser.name }),
    ]);
    res.json({ confirmed: true, total: demand?.confirmationsCount ?? 1 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/demands/:id/confirm", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.id);
    const currentUser = (req as any).currentUser;
    await db.delete(confirmationsTable)
      .where(and(eq(confirmationsTable.demandId, demandId), eq(confirmationsTable.userId, currentUser.id)));
    await db.update(demandsTable)
      .set({ confirmationsCount: sql`GREATEST(${demandsTable.confirmationsCount} - 1, 0)` })
      .where(eq(demandsTable.id, demandId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
