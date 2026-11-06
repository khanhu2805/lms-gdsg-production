export type ClassContact = { name: string; email: string; roles: string[] };
export function collectClassContacts(records: Array<{ name: string; email: string; role: string }>): ClassContact[] {
  const unique = new Map<string, ClassContact>();
  for (const record of records) {
    const email = record.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const existing = unique.get(email);
    if (existing) {
      if (!existing.roles.includes(record.role)) existing.roles.push(record.role);
    } else unique.set(email, { name: record.name, email, roles: [record.role] });
  }
  return [...unique.values()].sort((a, b) => a.email.localeCompare(b.email));
}
function csvCell(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, " ");
  const safe = /^\s*[=+\-@\t]/.test(cleaned) ? "'" + cleaned : cleaned;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function classContactsCsv(contacts: ClassContact[]): string {
  return "\uFEFF" + [
    ["Họ tên", "Email", "Vai trò"].map(csvCell).join(","),
    ...contacts.map((person) => [person.name, person.email, person.roles.join("; ")].map(csvCell).join(",")),
  ].join("\r\n") + "\r\n";
}
export function classContactsTxt(contacts: ClassContact[]): string {
  return contacts.map((person) => person.email).join(", ") + "\n";
}
