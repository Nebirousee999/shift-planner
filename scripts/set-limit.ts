import { db } from "../db/client.js";

const ORG_ID = "b802b6e2-0f80-4dac-956c-2e8969c85e95";

async function main() {
  await db.execute(
    `UPDATE organizations SET max_locations = 999 WHERE id = '${ORG_ID}'`
  );
  console.log("✅ max_locations → 999 для org", ORG_ID);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});