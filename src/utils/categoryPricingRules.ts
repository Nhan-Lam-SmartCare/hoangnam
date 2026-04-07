export type RoundingRule = "integer" | "hundred" | "thousand";

export interface CategoryPricingRule {
  markupPercent: number;
  roundingRule: RoundingRule;
}

const STORAGE_KEY = "category_pricing_rules_v1";

const DEFAULT_RULE: CategoryPricingRule = {
  markupPercent: 50,
  roundingRule: "integer",
};

const normalizeCategoryKey = (categoryName: string) =>
  String(categoryName || "").trim().toLowerCase();

export function applyRounding(value: number, rule: RoundingRule): number {
  const safeValue = Number(value || 0);
  if (safeValue <= 0) return 0;

  if (rule === "thousand") return Math.round(safeValue / 1000) * 1000;
  if (rule === "hundred") return Math.round(safeValue / 100) * 100;
  return Math.round(safeValue);
}

export function calcSellingFromRule(
  importPrice: number,
  markupPercent: number,
  roundingRule: RoundingRule
): number {
  const safeImport = Number(importPrice || 0);
  const safeMarkup = Math.max(0, Number(markupPercent || 0));
  if (safeImport <= 0) return 0;

  const raw = safeImport * (1 + safeMarkup / 100);
  return applyRounding(raw, roundingRule);
}

export function getAllCategoryPricingRules(): Record<string, CategoryPricingRule> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<CategoryPricingRule>>;

    const normalized: Record<string, CategoryPricingRule> = {};
    Object.entries(parsed || {}).forEach(([key, value]) => {
      if (!key) return;
      const roundingRule =
        value?.roundingRule === "hundred" || value?.roundingRule === "thousand"
          ? value.roundingRule
          : "integer";
      normalized[key] = {
        markupPercent: Math.max(0, Math.round(Number(value?.markupPercent ?? DEFAULT_RULE.markupPercent))),
        roundingRule,
      };
    });

    return normalized;
  } catch {
    return {};
  }
}

export function getCategoryPricingRule(categoryName: string): CategoryPricingRule {
  const all = getAllCategoryPricingRules();
  const key = normalizeCategoryKey(categoryName);
  if (!key) return { ...DEFAULT_RULE };
  return all[key] || { ...DEFAULT_RULE };
}

export function setCategoryPricingRule(
  categoryName: string,
  rule: CategoryPricingRule
): void {
  const key = normalizeCategoryKey(categoryName);
  if (!key) return;

  const all = getAllCategoryPricingRules();
  all[key] = {
    markupPercent: Math.max(0, Math.round(Number(rule.markupPercent || 0))),
    roundingRule:
      rule.roundingRule === "hundred" || rule.roundingRule === "thousand"
        ? rule.roundingRule
        : "integer",
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
