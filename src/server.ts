import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import authPlugin from "./plugins/auth.js";
import 'dotenv/config';
import { authRoutes } from "./modules/auth/auth.routes.js";
import { shiftTemplatesRoutes } from "./modules/shift-templates/shift-templates.routes.js";
import { scheduleWeeksRoutes } from "./modules/schedule-weeks/schedule-weeks.routes.js";
import { scheduledShiftsRoutes } from "./modules/scheduled-shifts/scheduled-shifts.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { timeEntriesRoutes } from "./modules/time-entries/time-entries.routes.js";
import { meRoutes } from "./modules/me/me.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { swapsRoutes } from "./modules/swaps/swaps.routes.js";
import { vacationsRoutes } from "./modules/vacations/vacations.routes.js";
import { exportRoutes } from "./modules/export/export.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { organizationRoutes } from "./modules/organization/organization.routes.js";
import { customTemplatesRoutes } from "./modules/documents/custom-templates.routes.js";
import { batchRoutes } from "./modules/documents/batch.routes.js";
import { shiftChangeRequestsRoutes } from "./modules/shift-change-requests/shift-change-requests.routes.js";
import { sickLeavesRoutes } from "./modules/sick-leaves/sick-leaves.routes.js";
import { locationsRoutes } from "./modules/locations/locations.routes.js";
import { demoRoutes } from "./modules/demo/demo.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length"],
});
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev_secret_change_me",
});
await app.register(authPlugin);

app.get("/health", async () => ({ status: "ok", ts: Date.now() }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(shiftTemplatesRoutes, { prefix: "/api/shift-templates" });
await app.register(scheduleWeeksRoutes, { prefix: "/api/schedule-weeks" });
await app.register(scheduledShiftsRoutes, { prefix: "/api/scheduled-shifts" });
await app.register(usersRoutes, { prefix: "/api/users" });
await app.register(timeEntriesRoutes, { prefix: "/api/time-entries" });
await app.register(meRoutes, { prefix: "/api/me" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
await app.register(documentsRoutes, { prefix: "/api/documents" });
await app.register(swapsRoutes, { prefix: "/api/swaps" });
await app.register(vacationsRoutes, { prefix: "/api/vacations" });
await app.register(exportRoutes, { prefix: "/api/export" });
await app.register(analyticsRoutes, { prefix: "/api/analytics" });
await app.register(organizationRoutes, { prefix: "/api/organization" });
await app.register(customTemplatesRoutes, { prefix: "/api/documents/custom" });
await app.register(batchRoutes, { prefix: "/api/documents/batch" });
await app.register(shiftChangeRequestsRoutes, { prefix: "/api/shift-change-requests" });
await app.register(sickLeavesRoutes, { prefix: "/api/sick-leaves" });
await app.register(locationsRoutes, { prefix: "/api/locations" });
await app.register(demoRoutes, { prefix: "/api/demo" });
await app.register(paymentsRoutes, { prefix: "/api/payments" });
await app.register(webhooksRoutes, { prefix: "/api/webhooks" });

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`🚀 API ready at http://localhost:${port}`);