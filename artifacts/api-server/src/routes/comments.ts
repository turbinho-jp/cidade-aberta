import { Router } from "express";
import { db, commentsTable, demandsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, getUserFromCookie } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router = Router();

router.get("/demands/:id/comments", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const comments = await db.select().from(commentsTable)
      .where(and(eq(commentsTable.demandId, id), eq(commentsTable.isModerated, false)))
      .orderBy(commentsTable.createdAt);
    res.json(comments.map(c => ({
      id: c.id, demandId: c.demandId, content: c.content, authorId: c.authorId,
      authorName: c.authorName, authorAvatarUrl: c.authorAvatarUrl,
      isModerated: c.isModerated, isOfficial: c.isOfficial, createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/demands/:id/comments", requireAuth, async (req, res) => {
  try {
    const demandId = parseInt(req.params.id);
    const currentUser = (req as any).currentUser;
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "Content required" }); return; }

    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!demand) { res.status(404).json({ error: "Demand not found" }); return; }

    const isOfficial = ["admin", "secretary", "moderator"].includes(currentUser.role);
    const [comment] = await db.insert(commentsTable).values({
      demandId, content, authorId: currentUser.id, authorName: currentUser.name, isOfficial,
    }).returning();

    await Promise.all([
      db.update(demandsTable).set({ commentsCount: sql`${demandsTable.commentsCount} + 1` }).where(eq(demandsTable.id, demandId)),
      db.update(usersTable).set({ commentsCount: sql`${usersTable.commentsCount} + 1`, points: sql`${usersTable.points} + 2` }).where(eq(usersTable.id, currentUser.id)),
      logActivity({ type: "comment_added", description: `Novo comentário em: ${demand.title}`, demandId, demandTitle: demand.title, actorName: currentUser.name }),
    ]);

    res.status(201).json({
      id: comment.id, demandId: comment.demandId, content: comment.content,
      authorId: comment.authorId, authorName: comment.authorName,
      authorAvatarUrl: comment.authorAvatarUrl, isModerated: comment.isModerated,
      isOfficial: comment.isOfficial, createdAt: comment.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(commentsTable).set({ isModerated: true }).where(eq(commentsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
