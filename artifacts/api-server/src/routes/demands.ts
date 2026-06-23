import { Router } from "express";
import { db, demandsTable, categoriesTable, neighborhoodsTable, departmentsTable, timelineTable, confirmationsTable, serviceOrdersTable, teamsTable } from "@workspace/db";
import { eq, and, sql, ilike, desc, inArray } from "drizzle-orm";
import { getUserFromCookie, requireAuth, optionalAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router = Router();

function formatDemand(d: any, category?: any, neighborhood?: any, department?: any, isConfirmedByMe = false) {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    categoryId: d.categoryId,
    category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : undefined,
    neighborhoodId: d.neighborhoodId,
    neighborhood: neighborhood ? { id: neighborhood.id, name: neighborhood.name } : undefined,
    departmentId: d.departmentId,
    department: department ? { id: department.id, name: department.name, description: department.description } : undefined,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
    photoUrl: d.photoUrl,
    confirmationsCount: d.confirmationsCount,
    commentsCount: d.commentsCount,
    isConfirmedByMe,
    authorId: d.authorId,
    authorName: d.authorName,
    publicResponse: d.publicResponse,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/demands", optionalAuth, async (req, res) => {
  try {
    const { status, categoryId, neighborhoodId, departmentId, search, limit = "20", offset = "0" } = req.query as any;
    const conditions: any[] = [];
    if (status) conditions.push(eq(demandsTable.status, status));
    if (categoryId) conditions.push(eq(demandsTable.categoryId, parseInt(categoryId)));
    if (neighborhoodId) conditions.push(eq(demandsTable.neighborhoodId, parseInt(neighborhoodId)));
    if (departmentId) conditions.push(eq(demandsTable.departmentId, parseInt(departmentId)));
    if (search) conditions.push(ilike(demandsTable.title, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [demands, [{ count }]] = await Promise.all([
      db.select().from(demandsTable).where(where).orderBy(desc(demandsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset)),
      db.select({ count: sql<number>`count(*)::int` }).from(demandsTable).where(where),
    ]);

    const currentUser = (req as any).currentUser;
    let confirmedIds = new Set<number>();
    if (currentUser) {
      const confirmations = await db.select({ demandId: confirmationsTable.demandId })
        .from(confirmationsTable).where(eq(confirmationsTable.userId, currentUser.id));
      confirmedIds = new Set(confirmations.map(c => c.demandId));
    }

    const catIds = [...new Set(demands.map(d => d.categoryId))];
    const nbrIds = [...new Set(demands.map(d => d.neighborhoodId))];
    const [categories, neighborhoods] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
    ]);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const nbrMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));

    res.json({
      demands: demands.map(d => formatDemand(d, catMap[d.categoryId], nbrMap[d.neighborhoodId], undefined, confirmedIds.has(d.id))),
      total: count,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/demands", requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).currentUser;
    const { title, description, categoryId, neighborhoodId, address, lat, lng, photoUrl } = req.body;
    if (!title || !description || !categoryId || !neighborhoodId || !address || lat == null || lng == null) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const [neighborhood] = await db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, neighborhoodId)).limit(1);
    const [demand] = await db.insert(demandsTable).values({
      title, description, categoryId, neighborhoodId, address, lat, lng,
      photoUrl: photoUrl || null,
      authorId: currentUser.id,
      authorName: currentUser.name,
      status: "open",
    }).returning();

    await Promise.all([
      db.update(neighborhoodsTable).set({ demandsCount: sql`${neighborhoodsTable.demandsCount} + 1` }).where(eq(neighborhoodsTable.id, neighborhoodId)),
      db.update(categoriesTable).set({ demandsCount: sql`${categoriesTable.demandsCount} + 1` }).where(eq(categoriesTable.id, categoryId)),
      db.update(usersTableRef()).set({ demandsCount: sql`demands_count + 1`, points: sql`points + 10` }).where(eq(usersTableRefId(), currentUser.id)),
      db.insert(timelineTable).values({ demandId: demand.id, event: "Demanda criada", description: "Demanda registrada pelo cidadão", actorName: currentUser.name, actorRole: "citizen", statusTo: "open" }),
      logActivity({ type: "demand_created", description: `Nova demanda: ${title}`, demandId: demand.id, demandTitle: title, actorName: currentUser.name, neighborhoodName: neighborhood?.name }),
    ]);

    res.status(201).json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to avoid circular import
function usersTableRef() {
  const { usersTable } = require("@workspace/db");
  return usersTable;
}
function usersTableRefId() {
  const { usersTable } = require("@workspace/db");
  return usersTable.id;
}

router.get("/demands/:id", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!demand) { res.status(404).json({ error: "Not found" }); return; }

    const currentUser = (req as any).currentUser;
    let isConfirmedByMe = false;
    if (currentUser) {
      const [conf] = await db.select().from(confirmationsTable).where(and(eq(confirmationsTable.demandId, id), eq(confirmationsTable.userId, currentUser.id))).limit(1);
      isConfirmedByMe = !!conf;
    }

    const [categories, neighborhoods, departments, timeline, serviceOrders] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, demand.categoryId)),
      db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, demand.neighborhoodId)),
      demand.departmentId ? db.select().from(departmentsTable).where(eq(departmentsTable.id, demand.departmentId)) : Promise.resolve([]),
      db.select().from(timelineTable).where(and(eq(timelineTable.demandId, id), eq(timelineTable.isPublic, true))).orderBy(timelineTable.createdAt),
      db.select().from(serviceOrdersTable).where(eq(serviceOrdersTable.demandId, id)),
    ]);

    const teamIds = [...new Set(serviceOrders.filter(o => o.teamId).map(o => o.teamId!))];
    const teams = teamIds.length ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    res.json({
      ...formatDemand(demand, categories[0], neighborhoods[0], departments[0], isConfirmedByMe),
      timeline: timeline.map(t => ({
        id: t.id, demandId: t.demandId, event: t.event, description: t.description,
        actorName: t.actorName, actorRole: t.actorRole, statusFrom: t.statusFrom,
        statusTo: t.statusTo, isPublic: t.isPublic, createdAt: t.createdAt.toISOString(),
      })),
      serviceOrders: serviceOrders.map(o => ({
        id: o.id, demandId: o.demandId, title: o.title, description: o.description,
        status: o.status, priority: o.priority, teamId: o.teamId,
        team: o.teamId ? teamMap[o.teamId] : undefined,
        estimatedCompletion: o.estimatedCompletion?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        slaHours: o.slaHours, notes: o.notes,
        createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/demands/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, priority, departmentId, publicResponse } = req.body;
    const [demand] = await db.update(demandsTable).set({
      ...(title && { title }),
      ...(description && { description }),
      ...(priority !== undefined && { priority }),
      ...(departmentId !== undefined && { departmentId }),
      ...(publicResponse !== undefined && { publicResponse }),
      updatedAt: new Date(),
    }).where(eq(demandsTable.id, id)).returning();
    if (!demand) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/demands/:id/timeline", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const events = await db.select().from(timelineTable)
      .where(and(eq(timelineTable.demandId, id), eq(timelineTable.isPublic, true)))
      .orderBy(timelineTable.createdAt);
    res.json(events.map(t => ({
      id: t.id, demandId: t.demandId, event: t.event, description: t.description,
      actorName: t.actorName, actorRole: t.actorRole, statusFrom: t.statusFrom,
      statusTo: t.statusTo, isPublic: t.isPublic, createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/demands/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, note, publicResponse } = req.body;
    if (!status) { res.status(400).json({ error: "Status required" }); return; }
    const [existing] = await db.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const currentUser = getUserFromCookie(req);
    const [demand] = await db.update(demandsTable).set({
      status,
      ...(publicResponse !== undefined && { publicResponse }),
      updatedAt: new Date(),
    }).where(eq(demandsTable.id, id)).returning();

    const neighborhoodName = existing.neighborhoodId ? (await db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, existing.neighborhoodId)).limit(1))[0]?.name : undefined;

    await Promise.all([
      db.insert(timelineTable).values({
        demandId: id, event: `Status atualizado para: ${status}`,
        description: note || publicResponse || undefined,
        actorName: currentUser?.name || "Sistema",
        actorRole: currentUser?.role || "system",
        statusFrom: existing.status, statusTo: status,
      }),
      ...(status === "completed" ? [
        db.update(neighborhoodsTable).set({ resolvedCount: sql`${neighborhoodsTable.resolvedCount} + 1` }).where(eq(neighborhoodsTable.id, existing.neighborhoodId)),
        logActivity({ type: "demand_resolved", description: `Demanda resolvida: ${existing.title}`, demandId: id, demandTitle: existing.title, actorName: currentUser?.name, neighborhoodName }),
      ] : [
        logActivity({ type: "status_changed", description: `Status atualizado para ${status}: ${existing.title}`, demandId: id, demandTitle: existing.title, actorName: currentUser?.name, neighborhoodName }),
      ]),
    ]);

    res.json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
