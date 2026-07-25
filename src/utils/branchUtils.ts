/**
 * Helper utility to determine if a branch is a Phone ("Điện thoại") branch based on branch ID or branch list.
 */
export function isPhoneBranch(
  branchId?: string | null,
  branches?: Array<{ id: string; name?: string }> | null
): boolean {
  if (!branchId) return false;
  const targetId = String(branchId).trim();
  const branchObj = branches?.find((b) => b.id === targetId);
  const name = (branchObj?.name || targetId).toLowerCase();
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return (
    name.includes("điện thoại") ||
    name.includes("dien thoai") ||
    normalized.includes("dien thoai") ||
    targetId.toLowerCase().includes("dienthoai") ||
    targetId.toLowerCase().includes("phone")
  );
}
