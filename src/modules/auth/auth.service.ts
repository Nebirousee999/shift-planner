import bcrypt from "bcryptjs";
import { isValidRealEmail } from "../../utils/email-validator.js";
import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users,
  organizations,
  locations,
  userLocations,
  scheduleWeeks,
  scheduledShifts,
  shiftTemplates,
  areas,
  userAreas,
  positionTemplates
} from "../../../db/schema.js";
import { mailerService } from "../../lib/mailer.service.js";
import { exportMonthToExcel } from "../../lib/export/excel.js";
import { getMonday } from "../../lib/time.js";

function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const authService = {
  async register(input: { name: string; email: string; password: string; orgName: string }) {
    // ЗАЩИТА ОТ БОТОВ: Проверяем реальность почты
    const isReal = await isValidRealEmail(input.email);
    if (!isReal) throw new Error("INVALID_EMAIL");
    
    const existing = await db.select().from(users).where(eq(users.email, input.email));
    if (existing.length > 0) throw new Error("EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const [org] = await db
      .insert(organizations)
      .values({ 
        name: input.orgName,
        trialEndsAt,
        tariffId: "pro",
        maxLocations: 1
      })
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

  async quickRegister(input: { email: string; name: string; guestData: any }) {
    // ЗАЩИТА ОТ БОТОВ: Проверяем реальность почты
    const isReal = await isValidRealEmail(input.email);
    if (!isReal) throw new Error("INVALID_EMAIL");
    
    const existing = await db.select().from(users).where(eq(users.email, input.email));
    if (existing.length > 0) throw new Error("EMAIL_TAKEN");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // 🔥 Транзакция: Создаем всё или ничего
    const result = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({
        name: "Моя организация",
        trialEndsAt: null,
        tariffId: "free",
        maxLocations: 1
      }).returning();

      const [user] = await tx.insert(users).values({
        orgId: org.id,
        name: input.name || "Владелец",
        email: input.email,
        passwordHash,
        tempPassword,
        role: "OWNER",
      }).returning();

      const [loc] = await tx.insert(locations).values({ orgId: org.id, name: "Основная" }).returning();
      await tx.insert(userLocations).values({ userId: user.id, locationId: loc.id });

      const [defaultArea] = await tx.insert(areas).values({ orgId: org.id, locationId: loc.id, name: "Локация 1" }).returning();
      await tx.insert(positionTemplates).values({ orgId: org.id, name: "Должность 1", color: "#3B82F6" });

      const createdEmployees = [];
      const usedGuestEmails = new Set<string>();
      let empCount = 0;
      if (input.guestData && input.guestData.employees) {
        for (const emp of input.guestData.employees) {
          if (empCount >= 3) break;
          if (!emp.name.trim()) continue;
          empCount++;
          // Проверяем, ввел ли владелец почту. Если да и она не занята — используем её. Иначе — генерируем заглушку.
          let empEmail = emp.email && emp.email.trim() ? emp.email.trim().toLowerCase() : "";
          if (empEmail) {
            const existingEmpEmail = await tx.select().from(users).where(eq(users.email, empEmail));
            if (existingEmpEmail.length > 0 || Array.from(usedGuestEmails).includes(empEmail)) {
              empEmail = ""; // Почта занята или дублируется — сбрасываем
            } else {
              usedGuestEmails.add(empEmail);
            }
          }
          const finalEmpEmail = empEmail || `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}@shift-planner.ru`;
          
          const empPass = emp.password && emp.password.length >= 6 ? emp.password : generateTempPassword();
          const empHash = await bcrypt.hash(empPass, 10);
          
          const [newEmp] = await tx.insert(users).values({
            orgId: org.id,
            name: emp.name,
            email: finalEmpEmail,
            passwordHash: empHash,
            tempPassword: empPass,
            role: "EMPLOYEE",
            color: emp.color || "#3B82F6",
            hourlyRate: emp.rate ? String(emp.rate) : "300",
            position: "Должность 1",
          }).returning();
          await tx.insert(userAreas).values({ userId: newEmp.id, areaId: defaultArea.id });
          await tx.insert(userLocations).values({ userId: newEmp.id, locationId: loc.id });
          createdEmployees.push({ ...newEmp, rawPassword: empPass });
        }
      }

      let excelDataForExport = null;
      let firstWeekId = null;

      if (createdEmployees.length > 0 && input.guestData.startDate) {
        const monday = getMonday(input.guestData.startDate);
        const globalStartDate = new Date(input.guestData.startDate + "T00:00:00Z");
        
        // Создаем 4 недели (на месяц)
        const weeksMap = [];
        for (let w = 0; w < 4; w++) {
          const wStart = new Date(monday + "T00:00:00Z");
          wStart.setUTCDate(wStart.getUTCDate() + w * 7);
          
          const isPublished = w === 0;
          
          const [newWeek] = await tx.insert(scheduleWeeks).values({
            orgId: org.id,
            locationId: loc.id,
            weekStartDate: wStart.toISOString().slice(0, 10),
            status: isPublished ? "PUBLISHED" : "DRAFT",
            publishedAt: isPublished ? new Date() : null
          }).returning();
          weeksMap.push(newWeek);
        }
        firstWeekId = weeksMap[0]?.id;

        // Создаем шаблоны смен (Смена 1, Смена 2 и т.д. по уникальному времени)
        const templatesMap = new Map();
        for (const emp of input.guestData.employees) {
          const sTime = emp.startTime || "09:00";
          const eTime = emp.endTime || "18:00";
          const key = `${sTime}-${eTime}`;
          if (!templatesMap.has(key)) {
            const [newTpl] = await tx.insert(shiftTemplates).values({
              orgId: org.id,
              name: `Смена ${templatesMap.size + 1}`,
              startTime: sTime,
              endTime: eTime,
              color: "#3B82F6"
            }).returning();
            templatesMap.set(key, newTpl.id);
          }
        }

        const shiftsToInsert = [];

        for (let i = 0; i < createdEmployees.length; i++) {
          const emp = createdEmployees[i];
          const empData = input.guestData.employees.find((e: any) => e.name === emp.name) || input.guestData.employees[i];
          if (!empData) continue;

          const sTime = empData.startTime || "09:00";
          const eTime = empData.endTime || "18:00";
          const templateId = templatesMap.get(`${sTime}-${eTime}`);

          const empStart = empData.startDate ? new Date(empData.startDate + "T00:00:00Z") : globalStartDate;
          const cycleParts = (empData.cycle || "2/2").split("/");
          const workDays = Number(cycleParts[0]) || 2;
          const offDays = Number(cycleParts[1]) || 2;
          const cycleLen = workDays + offDays;

          for (let d = 0; d < 28; d++) {
            const currentDate = new Date(monday + "T00:00:00Z");
            currentDate.setUTCDate(currentDate.getUTCDate() + d);
            
            if (currentDate < empStart) continue;

            const weekIdx = Math.floor(d / 7);
            if (weekIdx >= weeksMap.length) continue;

            const dateStr = currentDate.toISOString().slice(0, 10);
            const diffDays = Math.floor((currentDate.getTime() - empStart.getTime()) / (1000 * 3600 * 24));
            let dayInCycle = diffDays % cycleLen;
            if (dayInCycle < 0) dayInCycle += cycleLen;

            if (dayInCycle < workDays) {
              shiftsToInsert.push({
                weekId: weeksMap[weekIdx].id,
                templateId: templateId,
                userId: emp.id,
                shiftDate: dateStr,
                startTime: sTime,
                endTime: eTime,
                status: "SCHEDULED"
              });
            }
          }
        }

        if (shiftsToInsert.length > 0) {
          await tx.insert(scheduledShifts).values(shiftsToInsert);
        }

        const allShiftsForExport = shiftsToInsert.map(s => ({
          userId: s.userId,
          userName: createdEmployees.find(e => e.id === s.userId)?.name || "—",
          shiftDate: s.shiftDate,
          startTime: s.startTime,
          endTime: s.endTime,
          templateName: "Смена",
          templateColor: "#3B82F6"
        }));

        excelDataForExport = {
          orgName: org.name,
          monthStartDate: monday,
          employees: createdEmployees.map(e => ({ id: e.id, name: e.name, hourlyRate: Number(e.hourlyRate || 0) })),
          shifts: allShiftsForExport
        };
      }

      return { org, user, excelDataForExport, firstWeekId };
    });

    // Генерируем Excel, если есть смены
    let excelBuffer = null;
    if (result.excelDataForExport && result.excelDataForExport.shifts.length > 0) {
      try {
        excelBuffer = await exportMonthToExcel(result.excelDataForExport);
      } catch (e) {
        console.error("Ошибка генерации Excel:", e);
      }
    }

    // Отправляем письмо
    try {
      await mailerService.sendWelcomeEmail(input.email, result.user.name, tempPassword, excelBuffer);
    } catch (e) {
      console.error("Ошибка отправки письма:", e);
    }

    return { id: result.user.id, email: result.user.email, orgId: result.org.id, role: result.user.role, firstWeekId: result.firstWeekId };
  },


  async guestSeed() {
    const { randomUUID } = await import('crypto');
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const tempEmail = `guest_${randomUUID().slice(0, 8)}@shift-planner.ru`;

    const result = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({
        name: 'Гостевая организация',
        tariffId: 'free',
        maxLocations: 5,
        trialEndsAt: null,
      }).returning();

      const [user] = await tx.insert(users).values({
        orgId: org.id,
        name: 'Владелец',
        email: tempEmail,
        passwordHash,
        tempPassword,
        role: 'OWNER',
      }).returning();

      const [loc] = await tx.insert(locations).values({
        orgId: org.id,
        name: 'Основная точка',
      }).returning();

      await tx.insert(userLocations).values({ userId: user.id, locationId: loc.id });

      const areaNames = ['Кухня', 'Столовая'];
      const areasCreated = [];
      for (const name of areaNames) {
        const [area] = await tx.insert(areas).values({ orgId: org.id, locationId: loc.id, name }).returning();
        areasCreated.push(area);
      }

      const positionNames = ['Повар', 'Кассир', 'Официант'];
      const positionsCreated = [];
      for (const name of positionNames) {
        const [pos] = await tx.insert(positionTemplates).values({ orgId: org.id, name, color: '#3B82F6' }).returning();
        positionsCreated.push(pos);
      }

      const employeeSpecs = [
        { name: 'Анна Смирнова', position: 'Повар', rate: '400', areaId: areasCreated[0].id, color: '#F59E0B' },
        { name: 'Дмитрий Козлов', position: 'Кассир', rate: '350', areaId: areasCreated[1].id, color: '#3B82F6' },
        { name: 'Елена Волкова', position: 'Официант', rate: '300', areaId: areasCreated[0].id, color: '#8B5CF6' },
      ];

      const createdEmployees = [];
      for (const spec of employeeSpecs) {
        const empTempPassword = generateTempPassword();
        const empHash = await bcrypt.hash(empTempPassword, 10);
        const empEmail = `guest_emp_${randomUUID().slice(0, 8)}@shift-planner.ru`;
        const [emp] = await tx.insert(users).values({
          orgId: org.id, name: spec.name, email: empEmail, passwordHash: empHash, tempPassword: empTempPassword,
          role: 'EMPLOYEE', position: spec.position, hourlyRate: spec.rate, color: spec.color,
        }).returning();
        await tx.insert(userLocations).values({ userId: emp.id, locationId: loc.id });
        await tx.insert(userAreas).values({ userId: emp.id, areaId: spec.areaId });
        createdEmployees.push(emp);
      }

      const templates = [
        { name: 'Утренняя', startTime: '08:00', endTime: '16:00', color: '#F59E0B' },
        { name: 'Вечерняя', startTime: '16:00', endTime: '22:00', color: '#8B5CF6' },
      ];
      const createdTemplates = [];
      for (const t of templates) {
        const [tpl] = await tx.insert(shiftTemplates).values({ orgId: org.id, name: t.name, startTime: t.startTime, endTime: t.endTime, color: t.color }).returning();
        createdTemplates.push(tpl);
      }

      const { getMonday } = await import('../../lib/time.js');
      const mondayRaw = getMonday(new Date().toISOString().slice(0, 10));
      const monday = typeof mondayRaw === "string" ? mondayRaw : mondayRaw.toISOString().slice(0, 10);

      const [week] = await tx.insert(scheduleWeeks).values({
        orgId: org.id, locationId: loc.id, weekStartDate: monday, status: 'DRAFT',
      }).returning();

      const addDays = (dateStr, n) => {
        const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
      };

      const shiftPlan = [
        { day: 0, emp: 0, tpl: 0 }, { day: 0, emp: 1, tpl: 0 }, { day: 0, emp: 2, tpl: 1 },
        { day: 1, emp: 0, tpl: 0 }, { day: 1, emp: 1, tpl: 1 }, { day: 1, emp: 2, tpl: 1 },
        { day: 2, emp: 1, tpl: 0 }, { day: 2, emp: 2, tpl: 0 }, { day: 2, emp: 0, tpl: 1 },
        { day: 3, emp: 2, tpl: 0 }, { day: 3, emp: 0, tpl: 1 }, { day: 3, emp: 1, tpl: 1 },
        { day: 4, emp: 0, tpl: 0 }, { day: 4, emp: 1, tpl: 0 }, { day: 4, emp: 2, tpl: 1 },
        { day: 5, emp: 1, tpl: 0 }, { day: 5, emp: 2, tpl: 1 }, { day: 5, emp: 0, tpl: 1 },
        { day: 6, emp: 0, tpl: 0 }, { day: 6, emp: 1, tpl: 0 }, { day: 6, emp: 2, tpl: 1 },
      ];

      await tx.insert(scheduledShifts).values(shiftPlan.map((p) => ({
        weekId: week.id, templateId: createdTemplates[p.tpl].id, userId: createdEmployees[p.emp].id,
        shiftDate: addDays(monday, p.day), startTime: createdTemplates[p.tpl].startTime, endTime: createdTemplates[p.tpl].endTime, status: 'SCHEDULED',
      })));

      return { org, user, week };
    });

    return { user: result.user, token: null };
  },

  async resetPassword(email: string) {
    email = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    // Не раскрываем существование аккаунта — отвечаем одинаково
    if (!user) return { ok: true };

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.update(users)
      .set({ passwordHash, tempPassword })
      .where(eq(users.id, user.id));

    // САМОПРОВЕРКА: перечитываем пользователя и сверяем пароль с базой
    const [check] = await db.select().from(users).where(eq(users.id, user.id));
    const verified = await bcrypt.compare(tempPassword, check.passwordHash);
    console.log("📧 reset-password: пароль:", tempPassword, "| в базе всё совпадает:", verified);

    let mailSent = false;
    try {
      await mailerService.sendWelcomeEmail(email, user.name, tempPassword, null);
      mailSent = true;
    } catch (e) {
      console.error("❌ Ошибка отправки письма (reset-password):", e?.message ?? e);
      console.error("Полная ошибка:", e);
    }
    return { ok: true, mailSent };
  },

  async updateEmail(userId: string, newEmail: string) {
    newEmail = newEmail.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, newEmail));
    if (existing.length > 0) throw new Error("EMAIL_TAKEN");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await db.update(users)
      .set({ email: newEmail, passwordHash, tempPassword })
      .where(eq(users.id, userId));

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (user) {
      await mailerService.sendWelcomeEmail(newEmail, user.name, tempPassword, null);
    }
    return { ok: true };
  },

  async login(input: { email: string; password: string }) {
    input.email = input.email.trim().toLowerCase();
    input.password = input.password.trim();
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
    return { id: user.id, email: user.email, orgId: user.orgId, role: user.role };
  },
};