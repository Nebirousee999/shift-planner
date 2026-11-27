import { createHash } from "node:crypto";
import { createHash } from "node:crypto";
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
import { exportMonthToExcel, exportYearToExcel } from "../../lib/export/excel.js";
import archiver from "archiver";
import { getMonday } from "../../lib/time.js";

// Тёмно-синий цвет для Excel, если смена задевает ночные часы (22:00–06:00)
function nightColorFor(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm;
  let e = eh * 60 + em;
  if (e <= s) e += 24 * 60;
  for (let t = s; t < e; t++) {
    const hour = Math.floor((t % (24 * 60)) / 60);
    if (hour >= 22 || hour < 6) return "#312E81";
  }
  return "#3B82F6";
}

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

  async quickRegister(input: { email: string; name: string; guestData: any; mode?: string; year?: number; exportMode?: string; selectedEmpId?: string }) {
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
        trialEndsAt: (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })(),
        tariffId: "pro",
        maxLocations: 5
      }).returning();

      const [user] = await tx.insert(users).values({
        orgId: org.id,
        name: input.name || "Владелец",
        email: input.email,
        passwordHash,
        tempPassword,
        role: "OWNER",
      }).returning();

      // 1. Локации
      const locationsMap = new Map();
      if (input.guestData?.locations && input.guestData.locations.length > 0) {
        for (const loc of input.guestData.locations) {
          const [nl] = await tx.insert(locations).values({ orgId: org.id, name: loc.name || "Точка" }).returning();
          locationsMap.set(loc.id, nl.id);
        }
      } else {
        const [nl] = await tx.insert(locations).values({ orgId: org.id, name: "Основная" }).returning();
        locationsMap.set("default", nl.id);
      }
      const defaultLocId = Array.from(locationsMap.values())[0];
      await tx.insert(userLocations).values({ userId: user.id, locationId: defaultLocId });

      // 2. Зоны (привязаны к локациям)
      const areasMap = new Map();
      let defaultAreaId = null;
      if (input.guestData?.areas && input.guestData.areas.length > 0) {
        for (const area of input.guestData.areas) {
          const newLocId = locationsMap.get(area.locationId) || defaultLocId;
          const [na] = await tx.insert(areas).values({ orgId: org.id, locationId: newLocId, name: area.name || "Зона" }).returning();
          areasMap.set(area.id, na.id);
          if (!defaultAreaId) defaultAreaId = na.id;
        }
      } else {
        const [na] = await tx.insert(areas).values({ orgId: org.id, locationId: defaultLocId, name: "Локация 1" }).returning();
        defaultAreaId = na.id;
      }

      // 3. Должности
      if (input.guestData?.positions && input.guestData.positions.length > 0) {
        for (const pos of input.guestData.positions) {
          await tx.insert(positionTemplates).values({ orgId: org.id, name: pos.name || "Должность", color: pos.color || "#3B82F6" });
        }
      } else {
        await tx.insert(positionTemplates).values({ orgId: org.id, name: "Должность 1", color: "#3B82F6" });
      }

      const createdEmployees = [];
      const usedGuestEmails = new Set<string>();
      let empCount = 0;
      if (input.guestData && input.guestData.employees) {
        for (const emp of input.guestData.employees) {
          
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
          const userLocIds = (emp.locationIds || []).map((id: string) => locationsMap.get(id)).filter(Boolean);
          const userAreaIds = (emp.areaIds || []).map((id: string) => areasMap.get(id)).filter(Boolean);
          
          if (userLocIds.length === 0) userLocIds.push(defaultLocId);
          if (userAreaIds.length === 0 && defaultAreaId) userAreaIds.push(defaultAreaId);

          for (const lid of userLocIds) {
            await tx.insert(userLocations).values({ userId: newEmp.id, locationId: lid });
          }
          for (const aid of userAreaIds) {
            await tx.insert(userAreas).values({ userId: newEmp.id, areaId: aid });
          }
          
          createdEmployees.push({ ...newEmp, rawPassword: empPass });
        }
      }

      let excelDataForExport = null;
      let firstWeekId = null;

      if (createdEmployees.length > 0 && input.guestData.weeks && input.guestData.weeks.length > 0) {
        // ПРЯМОЙ ПЕРЕНОС НЕДЕЛЬ И СМЕН ИЗ ГОСТЕВОГО РЕЖИМА
        const guestUserMap = new Map();
        for (let i = 0; i < input.guestData.employees.length; i++) {
          if (createdEmployees[i]) {
            guestUserMap.set(input.guestData.employees[i].id, createdEmployees[i].id);
          }
        }

        const templatesMap = new Map();
        // Переносим шаблоны смен
        if (input.guestData.templates && input.guestData.templates.length > 0) {
          for (const tpl of input.guestData.templates) {
            const [nt] = await tx.insert(shiftTemplates).values({
              orgId: org.id,
              name: tpl.name || "Смена",
              startTime: tpl.startTime,
              endTime: tpl.endTime,
              color: tpl.color || "#3B82F6"
            }).returning();
            templatesMap.set(tpl.id, nt.id);
          }
        }

        const guestWeeks = input.guestData.weeks;

        for (const gw of guestWeeks) {
          const [newWeek] = await tx.insert(scheduleWeeks).values({
            orgId: org.id,
            locationId: defaultLocId,
            weekStartDate: gw.weekStartDate,
            status: gw.status || "PUBLISHED",
            publishedAt: gw.status === "PUBLISHED" ? new Date() : null
          }).returning();

          if (!firstWeekId) firstWeekId = newWeek.id;

          if (gw.shifts && gw.shifts.length > 0) {
            const shiftsToInsert = [];
            for (const s of gw.shifts) {
              const realUserId = guestUserMap.get(s.userId);
              if (!realUserId) continue;

              let tplId = s.templateId ? templatesMap.get(s.templateId) : null;
              if (!tplId) {
                // Фоллбэк, если шаблон не передался
                const tplKey = `${s.startTime}-${s.endTime}`;
                tplId = templatesMap.get(tplKey);
                if (!tplId) {
                  const [nt] = await tx.insert(shiftTemplates).values({
                    orgId: org.id, name: `Смена ${templatesMap.size + 1}`, startTime: s.startTime, endTime: s.endTime, color: nightColorFor(s.startTime, s.endTime)
                  }).returning();
                  tplId = nt.id;
                  templatesMap.set(tplKey, tplId);
                }
              }

              shiftsToInsert.push({
                weekId: newWeek.id,
                templateId: tplId,
                userId: realUserId,
                shiftDate: s.shiftDate,
                startTime: s.startTime,
                endTime: s.endTime,
                status: "SCHEDULED"
              });
            }
            if (shiftsToInsert.length > 0) {
              await tx.insert(scheduledShifts).values(shiftsToInsert);
            }
          }
        }

        // Собираем данные для Excel
        const allShiftsForExport = [];
        for (const gw of guestWeeks) {
          if (!gw.shifts) continue;
          for (const s of gw.shifts) {
            const realUserId = guestUserMap.get(s.userId);
            if (!realUserId) continue;
            allShiftsForExport.push({
              userId: realUserId,
              userName: createdEmployees.find(e => e.id === realUserId)?.name || "—",
              shiftDate: s.shiftDate,
              startTime: s.startTime,
              endTime: s.endTime,
              templateName: "Смена",
              templateColor: nightColorFor(s.startTime, s.endTime)
            });
          }
        }

        excelDataForExport = {
          orgName: org.name,
          monthStartDate: guestWeeks[0]?.weekStartDate || input.guestData.startDate || new Date().toISOString().slice(0, 10),
          employees: createdEmployees.map(e => ({ id: e.id, name: e.name, hourlyRate: Number(e.hourlyRate || 0) })),
          shifts: allShiftsForExport
        };
      } else if (createdEmployees.length > 0 && input.guestData.startDate) {
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
            locationId: defaultLocId,
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
          // Паттерн дня: D — дневная смена, N — ночная, O — выходной (для циклов день/ночь)
          const pat = typeof empData.pattern === "string" ? empData.pattern.trim().toUpperCase() : "";
          const hasPattern = /^[DNO]+$/.test(pat);
          const cycleLen = hasPattern ? pat.length : workDays + offDays;

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

            let dayType = "D";
            if (hasPattern) {
              if (pat[dayInCycle] === "N") dayType = "N";
              if (pat[dayInCycle] === "O") continue;
            } else if (dayInCycle >= workDays) continue;

            const shiftStart = dayType === "N" ? (empData.nightStart || "22:00") : sTime;
            const shiftEnd = dayType === "N" ? (empData.nightEnd || "06:00") : eTime;

            let dayTemplateId = templateId;
            if (shiftStart !== sTime || shiftEnd !== eTime) {
              const nKey = `${shiftStart}-${shiftEnd}`;
              if (!templatesMap.has(nKey)) {
                const [nt] = await tx.insert(shiftTemplates).values({
                  orgId: org.id,
                  name: `Ночная смена ${templatesMap.size + 1}`,
                  startTime: shiftStart,
                  endTime: shiftEnd,
                  color: "#312E81"
                }).returning();
                templatesMap.set(nKey, nt.id);
              }
              dayTemplateId = templatesMap.get(nKey)!;
            }

            shiftsToInsert.push({
              weekId: weeksMap[weekIdx].id,
              templateId: dayTemplateId,
              userId: emp.id,
              shiftDate: dateStr,
              startTime: shiftStart,
              endTime: shiftEnd,
              status: "SCHEDULED"
            });
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
          templateColor: nightColorFor(s.startTime, s.endTime)
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

    // Генерируем Excel или ZIP для письма.
    // Опции могут приходить на верхнем уровне запроса, а могут лежать в guestData.
    // Если сотрудников несколько и exportMode не задан — по умолчанию собираем
    // ZIP (exportMode="all"), чтобы на почту пришёл архив, а не один Excel за месяц.
    const __multiEmps = Array.isArray((input.guestData as any)?.employees) && (input.guestData as any).employees.length > 1;
    const __optMode = input.mode ?? (input.guestData as any)?.mode;
    const __optYear = input.year ?? (input.guestData as any)?.year;
    const __optExportMode = input.exportMode ?? (input.guestData as any)?.exportMode ?? (__multiEmps ? "all" : undefined);
    const __optSelectedEmpId = input.selectedEmpId ?? (input.guestData as any)?.selectedEmpId;

    let attachmentBuffer = null;
    let attachmentName = "";
    if (input.guestData && input.guestData.employees && input.guestData.employees.length > 0) {
      try {
        const calcResult = await this.buildCalcExcel(input.guestData, {
          mode: __optMode,
          year: __optYear,
          exportMode: __optExportMode,
          selectedEmpId: __optSelectedEmpId
        });
        attachmentBuffer = calcResult.buffer;
        
        if (calcResult.filename) {
          attachmentName = calcResult.filename;
        }
      } catch (e) {
        console.error("Ошибка генерации файла для почты:", e);
      }
    }

    // Отправляем письмо
    try {
      await mailerService.sendWelcomeEmail(input.email, result.user.name, tempPassword, attachmentBuffer, attachmentName);
    } catch (e) {
      console.error("Ошибка отправки письма:", e);
    }

    return { id: result.user.id, email: result.user.email, orgId: result.org.id, role: result.user.role, firstWeekId: result.firstWeekId };
  },


  // ─── Excel с калькулятора без регистрации: тот же расчёт, что в превью ───
  async buildCalcExcel(guestData: any, options: { mode?: string, year?: number, exportMode?: string, selectedEmpId?: string } = {}): Promise<any> {
    const startDate: string | undefined = guestData?.startDate;
    if (!startDate) throw new Error("NO_DATE");

    const emps: any[] = (guestData?.employees || [])
      .filter((e: any) => e && String(e.name || "").trim())
      .slice(0, 6);
    if (emps.length === 0) throw new Error("NO_EMPLOYEES");

    // Функция для генерации смен на произвольный период (дней)
    const generateShifts = (emp: any, startDay: Date, daysCount: number) => {
      const res = [];
      const empName = String(emp.name).trim();
      const empId = emp.id || empName;
      const empStart = emp.startDate ? new Date(emp.startDate + "T00:00:00Z") : startDay;

      const sTime = emp.startTime || "09:00";
      const eTime = emp.endTime || "18:00";
      const nStart = emp.nightStart || "22:00";
      const nEnd = emp.nightEnd || "06:00";

      const pat = typeof emp.pattern === "string" ? emp.pattern.trim().toUpperCase() : "";
      const hasPattern = /^[DNO]+$/.test(pat);
      let workDays = 2;
      let cycleLen = 4;
      if (hasPattern) {
        cycleLen = pat.length;
      } else {
        const parts = String(emp.cycle || "2/2").split("/");
        workDays = Number(parts[0]) || 2;
        const offDays = Number(parts[1]) || 2;
        cycleLen = workDays + offDays;
      }

      for (let d = 0; d < daysCount; d++) {
        const currentDate = new Date(startDay);
        currentDate.setUTCDate(currentDate.getUTCDate() + d);
        if (currentDate < empStart) continue;

        let dayInCycle = Math.floor((currentDate.getTime() - empStart.getTime()) / (1000 * 3600 * 24)) % cycleLen;
        if (dayInCycle < 0) dayInCycle += cycleLen;

        let shiftStart: string | null = null;
        let shiftEnd: string | null = null;
        let isNight = false;
        if (hasPattern) {
          const t = pat[dayInCycle];
          if (t === "D") { shiftStart = sTime; shiftEnd = eTime; }
          else if (t === "N") { shiftStart = nStart; shiftEnd = nEnd; isNight = true; }
        } else if (dayInCycle < workDays) {
          shiftStart = sTime;
          shiftEnd = eTime;
        }
        if (!shiftStart || !shiftEnd) continue;

        res.push({
          userId: empId,
          userName: empName,
          shiftDate: currentDate.toISOString().slice(0, 10),
          startTime: shiftStart,
          endTime: shiftEnd,
          templateName: isNight ? "Ночная смена" : "Смена",
          templateColor: isNight ? "#312E81" : "#3B82F6",
        });
      }
      return res;
    };

    const getEmpData = (emp: any) => ({
      id: emp.id || String(emp.name).trim(),
      name: String(emp.name).trim(),
      hourlyRate: Number(emp.rate ?? emp.hourlyRate ?? 300),
      nightRate: Number(emp.nightRate ?? 20),
      holidayRate: Number(emp.holidayRate ?? 2),
    });

    if (options.mode === "year") {
      const targetYear = options.year || new Date().getFullYear();
      const yearStart = new Date(Date.UTC(targetYear, 0, 1));
      const daysInYear = (targetYear % 4 === 0 && (targetYear % 100 !== 0 || targetYear % 400 === 0)) ? 366 : 365;

      if (options.exportMode === "all") {
        // ZIP для всех
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        archive.on("data", (chunk: Buffer) => chunks.push(chunk));
        
        for (const emp of emps) {
          const shifts = generateShifts(emp, yearStart, daysInYear);
          const buffer = await exportYearToExcel({
            orgName: "График смен",
            year: targetYear,
            employee: getEmpData(emp),
            shifts,
          });
          const safeName = emp.name.replace(/[\/?*\[\]:]/g, "").slice(0, 31) || "Сотрудник";
          archive.append(buffer, { name: `Расписание смен ${emp.name} ${targetYear} год.xlsx` });
        }
        
        await archive.finalize();
        return { buffer: Buffer.concat(chunks), filename: `Расписание смен на ${targetYear} год.zip` };
      } else {
        // Один выбранный
        const targetId = options.selectedEmpId || emps[0].id;
        const emp = emps.find(e => (e.id || String(e.name).trim()) === targetId) || emps[0];
        const shifts = generateShifts(emp, yearStart, daysInYear);
        const buffer = await exportYearToExcel({
          orgName: "График смен",
          year: targetYear,
          employee: getEmpData(emp),
          shifts,
        });
        return { buffer, filename: `Расписание смен ${emp.name} ${targetYear} год.xlsx` };
      }
    }

    // Месячный режим
    const mondayRaw = getMonday(startDate);
    const monday = typeof mondayRaw === "string" ? mondayRaw : new Date(mondayRaw).toISOString().slice(0, 10);
    const monthStart = new Date(monday + "T00:00:00Z");
    const yearStr = monthStart.getUTCFullYear();
    const monthName = monthStart.toLocaleString("ru-RU", { month: "long" });

    if (options.exportMode === "all" && emps.length > 1) {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      
      for (const emp of emps) {
        const shifts = generateShifts(emp, monthStart, 28);
        const buffer = await exportMonthToExcel({
          orgName: "График смен",
          monthStartDate: monday,
          employees: [getEmpData(emp)],
          shifts,
        });
        const safeName = emp.name.replace(/[\/?*\[\]:]/g, "").slice(0, 31) || "Сотрудник";
        archive.append(buffer, { name: `Расписание смен ${emp.name} ${monthName} ${yearStr}.xlsx` });
      }
      await archive.finalize();
      return { buffer: Buffer.concat(chunks), filename: `Расписание смен на ${monthName} ${yearStr}.zip` };
    } else {
      const targetId = options.selectedEmpId || emps[0].id;
      const emp = emps.find(e => (e.id || String(e.name).trim()) === targetId) || emps[0];
      const shifts = generateShifts(emp, monthStart, 28);
      const buffer = await exportMonthToExcel({
        orgName: "График смен",
        monthStartDate: monday,
        employees: [getEmpData(emp)],
        shifts,
      });
      return { buffer, filename: `Расписание смен ${emp.name} ${monthName} ${yearStr}.xlsx` };
    }
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
        const [area] = await tx.insert(areas).values({ orgId: org.id, locationId: defaultLocId, name }).returning();
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
        orgId: org.id, locationId: defaultLocId, weekStartDate: monday, status: 'PUBLISHED', publishedAt: new Date(),
      }).returning();

      const addDays = (dateStr, n) => {
        const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
      };

      const shiftPlan = [
        // Пн
        { day: 0, emp: 0, tpl: 0 }, { day: 0, emp: 2, tpl: 1 },
        // Вт
        { day: 1, emp: 0, tpl: 0 }, { day: 1, emp: 1, tpl: 1 },
        // Ср
        { day: 2, emp: 1, tpl: 0 }, { day: 2, emp: 2, tpl: 0 }, { day: 2, emp: 0, tpl: 1 },
        // Чт
        { day: 3, emp: 2, tpl: 0 },
        // Пт
        { day: 4, emp: 0, tpl: 0 }, { day: 4, emp: 1, tpl: 0 }, { day: 4, emp: 2, tpl: 1 },
        // Сб
        { day: 5, emp: 1, tpl: 0 }, { day: 5, emp: 2, tpl: 1 },
        // Вс
        { day: 6, emp: 0, tpl: 0 }, { day: 6, emp: 1, tpl: 0 }, { day: 6, emp: 2, tpl: 1 }
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

    const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
    const cleanPassword = input.password.replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, "");

    const matches = await db.select().from(users).where(eq(users.email, input.email));
    console.log("[auth.login] email:", input.email, "| найдено пользователей:", matches.length);
    if (matches.length === 0) {
      console.log("[auth.login] пользователь не найден → INVALID_CREDENTIALS");
      throw new Error("INVALID_CREDENTIALS");
    }
    if (matches.length > 1) {
      console.warn("[auth.login] ВНИМАНИЕ: несколько пользователей с одним email!",
        matches.map(u => ({ id: u.id, orgId: u.orgId, role: u.role })));
    }

    let matchedUser: typeof matches[number] | null = null;
    let bcryptError: any = null;
    for (const user of matches) {
      const tmp = user.tempPassword ? String(user.tempPassword) : "";
      console.log("[auth.login] проверка id:", user.id,
        "| input.len:", cleanPassword.length,
        "| input.sha:", sha(cleanPassword),
        "| temp.len:", tmp.length,
        "| temp.sha:", sha(tmp),
        "| equal:", cleanPassword === tmp,
        "| raw.len:", input.password.length,
        "| raw.sha:", sha(input.password),
        "| rawEqualTemp:", input.password === tmp,
        "| passwordHash.len:", user.passwordHash ? String(user.passwordHash).length : "NULL");
      try {
        if (user.passwordHash && await bcrypt.compare(cleanPassword, String(user.passwordHash))) {
          matchedUser = user; break;
        }
        if (tmp && cleanPassword === tmp) {
          console.warn("[auth.login] вход по tempPassword для", input.email, "id:", user.id);
          matchedUser = user; break;
        }
      } catch (e: any) {
        console.error("[auth.login] bcrypt.compare упал для id", user.id, ":", e?.name, "|", e?.message);
        bcryptError = e;
      }
    }

    if (!matchedUser) {
      if (bcryptError) throw bcryptError;
      console.log("[auth.login] пароль не совпал ни с одним пользователем → INVALID_CREDENTIALS");
      throw new Error("INVALID_CREDENTIALS");
    }

    return { id: matchedUser.id, email: matchedUser.email, orgId: matchedUser.orgId, role: matchedUser.role };
  },
};