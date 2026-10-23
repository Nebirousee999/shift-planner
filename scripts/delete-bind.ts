import { db } from "./db/client.js";

async function main() {
  await db.execute("DELETE FROM user_messengers WHERE external_id = '141744495'");
  console.log("✅ Привязка MAX успешно удалена из базы!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});