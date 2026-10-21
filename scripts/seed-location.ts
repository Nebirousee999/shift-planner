import { db } from "../db/client.js";
import { locations, userLocations, organizations, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const USER_ID = "96219f6a-2198-4a19-b8c0-e4b46cd58e44";
const ORG_ID  = "6d976c35-5ac7-45ec-a26d-3561d9443e87";

async function main() {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, ORG_ID));
  if (!org) throw new Error("Org не найдена");
  const [user] = await db.select().from(users).where(eq(users.id, USER_ID));
  if (!user) throw new Error("User не найден");

  const existing = await db.select().from(locations).where(eq(locations.orgId, ORG_ID));
  if (existing.length > 0) {
    console.log("Локации уже есть:", existing.map(x => x.name));
    const link = await db.select().from(userLocations)
      .where(and(eq(userLocations.userId, USER_ID), eq(userLocations.locationId, existing[0].id)));
    if (!link.length) {
      await db.insert(userLocations).values({ userId: USER_ID, locationId: existing[0].id });
      console.log("Привязал user к локации:", existing[0].name);
    }
  } else {
    const [loc] = await db.insert(locations).values({ orgId: ORG_ID, name: "Основная" }).returning();
    await db.insert(userLocations).values({ userId: USER_ID, locationId: loc.id });
    console.log("Создана локация:", loc.name);
  }

  await db.update(organizations).set({ maxLocations: 999 }).where(eq(organizations.id, ORG_ID));
  console.log("max_locations → 999");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });