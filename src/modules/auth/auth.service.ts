import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { users, organizations, locations, userLocations } from "../../../db/schema.js";

export const authService = {
  async register(input: { name: string; email: string; password: string; orgName: string }) {
    const existing = await db.select().from(users).where(eq(users.email, input.email));
    if (existing.length > 0) throw new Error("EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const [org] = await db
      .insert(organizations)
      .values({ name: input.orgName })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        orgId: org.id,
        name: input.name,
        email: input.email,
        passwordHash,
        role: "OWNER",
      })
      .returning();

    const [loc] = await db
      .insert(locations)
      .values({ orgId: org.id, name: "Основная" })
      .returning();

    await db.insert(userLocations).values({ userId: user.id, locationId: loc.id });

    return { id: user.id, email: user.email, orgId: org.id, role: user.role };
  },

  async login(input: { email: string; password: string }) {
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
    return { id: user.id, email: user.email, orgId: user.orgId, role: user.role };
  },
};