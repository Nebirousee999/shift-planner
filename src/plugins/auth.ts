import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

export type Role = "OWNER" | "MANAGER" | "EMPLOYEE";

declare module "fastify" {
  interface FastifyRequest {
    user?: { sub: string; orgId: string; role: Role };
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      roles: Role[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "Не авторизован" });
      }
    }
  );

  app.decorate("requireRole", (roles: Role[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const userRole = req.user?.role;
      if (!userRole || !roles.includes(userRole)) {
        return reply
          .code(403)
          .send({ error: "Недостаточно прав для этого действия" });
      }
    };
  });
}

export default fp(authPlugin, { name: "auth-plugin" });