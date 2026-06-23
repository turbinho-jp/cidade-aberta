import { Router } from "express";
import { db, publicWorksTable, neighborhoodsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatWork(w: any, neighborhood?: any) {
  return {
    id: w.id, title: w.title, description: w.description, status: w.status,
    neighborhoodId: w.neighborhoodId, neighborhood: neighborhood ? { id: neighborhood.id, name: neighborhood.name } : undefined,
    departmentId: w.departmentId, investment: w.investment,
    startDate: w.startDate?.toISOString() ?? null,
    estimatedEnd: w.estimatedEnd?.toISOString() ?? null,
    completedAt: w.completedAt?.toISOString() ?? null,
    lat: w.lat, lng: w.lng, photoUrl: w.photoUrl,
    progressPercent: w.progressPercent, createdAt: w.createdAt.toISOString(),
  };
}

router.get("/public-works", async (req, res) => {
  try {
    const { status, limit = "20" } = req.query as any;
    const works = await db.select().from(publicWorksTable)
      .where(status ? eq(publicWorksTable.status, status) : undefined)
      .orderBy(desc(publicWorksTable.createdAt)).limit(parseInt(limit));
    const nbrIds = [...new Set(works.map(w => w.neighborhoodId))];
    const neighborhoods = nbrIds.length ? await db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, nbrIds[0])) : [];
    const nbrMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));
    res.json(works.map(w => formatWork(w, nbrMap[w.neighborhoodId])));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/public-works", async (req, res) => {
  try {
    const { title, description, status, neighborhoodId, departmentId, investment, startDate, estimatedEnd, lat, lng, progressPercent } = req.body;
    if (!title || !description || !neighborhoodId || !status) { res.status(400).json({ error: "Required fields missing" }); return; }
    const [work] = await db.insert(publicWorksTable).values({
      title, description, status, neighborhoodId,
      departmentId: departmentId || null,
      investment: investment || null,
      startDate: startDate ? new Date(startDate) : null,
      estimatedEnd: estimatedEnd ? new Date(estimatedEnd) : null,
      lat: lat || null, lng: lng || null,
      progressPercent: progressPercent ?? 0,
    }).returning();
    res.status(201).json(formatWork(work));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/public-works/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [work] = await db.select().from(publicWorksTable).where(eq(publicWorksTable.id, id)).limit(1);
    if (!work) { res.status(404).json({ error: "Not found" }); return; }
    const [neighborhood] = await db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, work.neighborhoodId)).limit(1);
    res.json(formatWork(work, neighborhood));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
