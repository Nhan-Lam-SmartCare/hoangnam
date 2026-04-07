import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "../contexts/AuthContext";

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function canAccessInventorySection(
  profile: UserProfile | null | undefined,
  user: User | null | undefined
): boolean {
  const role = profile?.role;

  if (role === "owner" || role === "manager") {
    return true;
  }

  if (role !== "staff") {
    return false;
  }

  const profileAny = (profile || {}) as Record<string, unknown>;
  const userMeta = (user?.user_metadata || {}) as Record<string, unknown>;

  const infoBlob = normalizeText(
    [
      profileAny.department,
      profileAny.position,
      userMeta.department,
      userMeta.position,
      userMeta.job_title,
      userMeta.title,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!infoBlob) {
    return false;
  }

  const allowKeywords = [
    "ban hang",
    "bán hàng",
    "sales",
    "sale",
    "quan ly kho",
    "quản lý kho",
    "kho",
    "warehouse",
    "thu kho",
  ];

  return allowKeywords.some((keyword) => infoBlob.includes(keyword));
}
