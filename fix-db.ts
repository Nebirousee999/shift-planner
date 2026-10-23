import { db } from "./db/client.js";
import { userMessengers } from "./db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Удаляем привязку...");
  await db.delete(userMessengers).where(eq(userMessengers.externalId, "141744495"));
  console.log("✅ Привязка MAX успешно удалена!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});