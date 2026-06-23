import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";

const router = Router();

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(categories.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, description: c.description, demandsCount: c.demandsCount })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, icon, color, description } = req.body;
    if (!name || !icon || !color) { res.status(400).json({ error: "Name, icon and color required" }); return; }
    const [cat] = await db.insert(categoriesTable).values({ name, icon, color, description: description || null }).returning();
    res.status(201).json({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, description: cat.description, demandsCount: cat.demandsCount });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
