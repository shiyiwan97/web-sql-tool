export type WorkspaceStateV1 = {
  version: 1;
  sql: string;
  updatedAt: string;
};

const KEY = "sql-web-tool-workspace-v1";

export function loadWorkspaceState(): WorkspaceStateV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<WorkspaceStateV1>;
    if (o.version !== 1) return null;
    if (typeof o.sql !== "string") return null;
    return {
      version: 1,
      sql: o.sql,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceSql(sql: string): void {
  const payload: WorkspaceStateV1 = {
    version: 1,
    sql,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

