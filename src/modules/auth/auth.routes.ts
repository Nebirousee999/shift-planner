import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authService } from "./auth.service.js";

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    orgName: z.string().min(2),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
    app.post("/register", async (req, reply) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }

        try {
            const user = await authService.register(parsed.data);
            const token = app.jwt.sign({
                sub: user.id,
                orgId: user.orgId,
                role: user.role,
            });
            return { user, token };
        } catch (e: any) {
            if (e.message === "EMAIL_TAKEN") {
                return reply.code(409).send({ error: "Email уже занят" });
            }
            app.log.error(e);
            return reply.code(500).send({ error: "Ошибка регистрации" });
        }
    });

    app.post("/quick-register", async (req, reply) => {
        try {
            const { email, name, guestData } = req.body;
            if (!email) return reply.code(400).send({ error: "Email обязателен" });

            const user = await authService.quickRegister({ email, name, guestData });
            const token = app.jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role });
            
            return { user, token };
        } catch (e: any) {
            if (e.message === "EMAIL_TAKEN") {
                return reply.code(409).send({ error: "Этот email уже зарегистрирован. Войдите в аккаунт." });
            }
            app.log.error(e);
            return reply.code(500).send({ error: "Ошибка регистрации" });
        }
    });

    app.post("/login", async (req, reply) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.flatten() });
        }

        try {
            const user = await authService.login(parsed.data);
            const token = app.jwt.sign({
                sub: user.id,
                orgId: user.orgId,
                role: user.role,
            });
            return { user, token };
        } catch {
            return reply.code(401).send({ error: "Неверный email или пароль" });
        }
    });
}
