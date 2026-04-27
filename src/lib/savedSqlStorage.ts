export type SavedSqlSlot = {
  id: string;
  name: string;
  sql: string;
  updatedAt: string;
};

const KEY = "sql-web-tool-saved-sql-v1";

export function loadSavedSqlSlots(): SavedSqlSlot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x, i) => {
      const o = x as Record<string, unknown>;
      return {
        id: String(o.id ?? `slot-${i}`),
        name: String(o.name ?? `存档 ${i + 1}`),
        sql: String(o.sql ?? ""),
        updatedAt: String(o.updatedAt ?? new Date().toISOString()),
      };
    });
  } catch {
    return [];
  }
}

export function persistSavedSqlSlots(slots: SavedSqlSlot[]): void {
  localStorage.setItem(KEY, JSON.stringify(slots));
}
