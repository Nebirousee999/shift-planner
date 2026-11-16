import validator from "validator";
import disposableDomains from "disposable-email-domains";
import dns from "node:dns/promises";

/**
 * Проверяет, является ли email реальным:
 * 1. Формат
 * 2. Домен не из списка временных (temp-mail, 10minutemail и т.д.)
 * 3. Домен имеет MX-записи (т.е. может принимать почту)
 */
export async function isValidRealEmail(email: string): Promise<boolean> {
  if (!email || typeof email !== "string") return false;
  
  const cleanEmail = email.trim().toLowerCase();
  
  if (!validator.isEmail(cleanEmail)) return false;

  const domain = cleanEmail.split("@")[1];
  
  if (disposableDomains.includes(domain)) return false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return false;
  } catch (e) {
    return false;
  }

  return true;
}
