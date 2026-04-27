export type SidebarUiState = {
  leftWidth: number;
  rightWidth: number;
  leftRatios: number[];
  rightRatios: number[];
};

const KEY = "sql-web-tool-sidebar-ui-v1";
const MIN_W = 200;
const MAX_W = 560;

export const sidebarWidthClamp = (w: number) =>
  Math.min(MAX_W, Math.max(MIN_W, Math.round(w)));

export function defaultSidebarUi(): SidebarUiState {
  return {
    leftWidth: 300,
    rightWidth: 300,
    leftRatios: [1],
    rightRatios: [1],
  };
}

export function loadSidebarUi(): SidebarUiState {
  const fb = defaultSidebarUi();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fb;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const lw = sidebarWidthClamp(Number(o.leftWidth) || fb.leftWidth);
    const rw = sidebarWidthClamp(Number(o.rightWidth) || fb.rightWidth);
    const lr = normalizeRatios(
      (Array.isArray(o.leftRatios) ? o.leftRatios : fb.leftRatios) as unknown[],
    );
    const rr = normalizeRatios(
      (Array.isArray(o.rightRatios) ? o.rightRatios : fb.rightRatios) as unknown[],
    );
    return { leftWidth: lw, rightWidth: rw, leftRatios: lr, rightRatios: rr };
  } catch {
    return fb;
  }
}

export function persistSidebarUi(s: SidebarUiState): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      leftRatios: s.leftRatios,
      rightRatios: s.rightRatios,
    }),
  );
}

export function normalizeRatios(raw: unknown[]): number[] {
  const nums = raw.map((x) => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [1];
  return nums.map((n) => n / sum);
}

/** 槽位数变化时重新均分比例 */
export function ratiosForSlotCount(_prev: number[], n: number): number[] {
  if (n <= 0) return [1];
  return normalizeRatios(Array(n).fill(1));
}
