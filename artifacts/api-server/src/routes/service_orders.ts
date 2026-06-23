import { Router } from "express";
import { db, serviceOrdersTable, teamsTable, demandsTable, timelineTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { getUserFromCookie } from "../lib/auth";
import { logActivity } from "../lib/activity";

const router = Router();

function formatOrder(o: any, team?: any, demand?: any) {
  return {
    id: o.id, demandId: o.demandId, demand: demand || undefined,
    title: o.title, description: o.description, status: o.status, priority: o.priority,
    teamId: o.teamId, team: team || undefined,
    estimatedCompletion: o.estimatedCompletion?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    slaHours: o.slaHours, notes: o.notes,
    createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/service-orders", async (req, res) => {
  try {
    const { status, teamId, demandId, limit = "20", offset = "0" } = req.query as any;
    const conditions: any[] = [];
    if (status) conditions.push(eq(serviceOrdersTable.status, status));
    if (teamId) conditions.push(eq(serviceOrdersTable.teamId, parseInt(teamId)));
    if (demandId) conditions.push(eq(serviceOrdersTable.demandId, parseInt(demandId)));
    const where = conditions.length ? and(...conditions) : undefined;
    const orders = await db.select().from(serviceOrdersTable).where(where)
      .orderBy(serviceOrdersTable.createdAt).limit(parseInt(limit)).offset(parseInt(offset));
    const teamIds = [...new Set(orders.filter(o => o.teamId).map(o => o.teamId!))];
    const teams = teamIds.length ? await db.select().from(teamsTable).where(eq(teamsTable.id, teamIds[0])) : [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    res.json(orders.map(o => formatOrder(o, o.teamId ? teamMap[o.teamId] : undefined)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/service-orders", async (req, res) => {
  try {
    const { demandId, title, description, priority, teamId, estimatedCompletion, slaHours } = req.body;
    if (!demandId || !title || !priority) { res.status(400).json({ error: "demandId, title and priority required" }); return; }
    const currentUser = getUserFromCookie(req);
    const [order] = await db.insert(serviceOrdersTable).values({
      demandId, title, description: description || null, priority,
      teamId: teamId || null,
      estimatedCompletion: estimatedCompletion ? new Date(estimatedCompletion) : null,
      slaHours: slaHours || null,
      status: teamId ? "assigned" : "pending",
    }).returning();

    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    await Promise.all([
      db.insert(timelineTable).values({ demandId, event: "Ordem de serviço criada", description: title, actorName: currentUser?.name || "Sistema", actorRole: currentUser?.role || "admin" }),
      db.update(demandsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(demandsTable.id, demandId)),
      logActivity({ type: "service_order_created", description: `OS criada: ${title}`, demandId, demandTitle: demand?.title, actorName: currentUser?.name }),
    ]);

    res.status(201).json(formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [order] = await db.select().from(serviceOrdersTable).where(eq(serviceOrdersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    const team = order.teamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, order.teamId)).limit(1))[0] : undefined;
    res.json(formatOrder(order, team));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/service-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, teamId, notes, completedAt } = req.body;
    const [order] = await db.update(serviceOrdersTable).set({
      ...(status && { status }),
      ...(teamId !== undefined && { teamId: teamId || null }),
      ...(notes !== undefined && { notes }),
      ...(completedAt && { completedAt: new Date(completedAt) }),
      updatedAt: new Date(),
    }).where(eq(serviceOrdersTable.id, id)).returning();
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
