import bcrypt from "bcryptjs";
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
import { exportWeekToExcel } from "../../lib/export/excel.js";
import { getMonday } from "../../lib/time.js";

function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const authService = {
  async register(input: { name: string; email: string; password: string; orgName: string }) {
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
      let empCount = 0;
      if (input.guestData && input.guestData.employees) {
        for (const emp of input.guestData.employees) {
          if (empCount >= 3) break;
          if (!emp.name.trim()) continue;
          empCount++;
          const empPass = emp.password && emp.password.length >= 6 ? emp.password : generateTempPassword();
          const empHash = await bcrypt.hash(empPass, 10);
          
          const [newEmp] = await tx.insert(users).values({
            orgId: org.id,
            name: emp.name,
            email: `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}@shift-planner.ru`,
            passwordHash: empHash,
            tempPassword: empPass,
            role: "EMPLOYEE",
            hourlyRate: emp.rate ? String(emp.rate) : "300",
            position: "Должность 1",
          }).returning();
          await tx.insert(userAreas).values({ userId: newEmp.id, areaId: defaultArea.id });
          await tx.insert(userLocations).values({ userId: newEmp.id, locationId: loc.id });
          createdEmployees.push({ ...newEmp, rawPassword: empPass });
        }
      }

      let weekDataForExport = null;
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
              name: `Смена ${templatesMap.size + 1} (${sTime}-${eTime})`,
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

        const firstWeekShifts = shiftsToInsert.filter(s => s.weekId === weeksMap[0].id);
        weekDataForExport = {
          weekStartDate: monday,
          orgName: org.name,
          shifts: firstWeekShifts.map(s => ({
            id: Math.random().toString(),
            shiftDate: s.shiftDate,
            startTime: s.startTime,
            endTime: s.endTime,
            userName: createdEmployees.find(e => e.id === s.userId)?.name || "—",
            templateName: "Смена",
            templateColor: "#3B82F6"
          }))
        };
      }

      return { org, user, weekDataForExport, firstWeekId };
    });

    // Генерируем Excel, если есть смены
    let excelBuffer = null;
    if (result.weekDataForExport && result.weekDataForExport.shifts.length > 0) {
      try {
        excelBuffer = await exportWeekToExcel(result.weekDataForExport);
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

  async login(input: { email: string; password: string }) {
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
    return { id: user.id, email: user.email, orgId: user.orgId, role: user.role };
  },
};