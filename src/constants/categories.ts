// Single source of truth for category colors, labels, and helpers.
// Used by CategoryDonutChart, activity badges, and the legend.

export const CATEGORY_COLORS: Record<string, string> = {
  transport:     "#3B82F6",
  food:          "#F59E0B",
  sightseeing:   "#10B981",
  adventure:     "#EF4444",
  shopping:      "#8B5CF6",
  stay:          "#14B8A6",
  other:         "#6B7280",
  uncategorized: "#9CA3AF",
};

export const CATEGORY_LABELS: Record<string, string> = {
  transport:     "Transport",
  food:          "Food",
  sightseeing:   "Sightseeing",
  adventure:     "Adventure",
  shopping:      "Shopping",
  stay:          "Stay",
  other:         "Other",
  uncategorized: "Uncategorized",
};

/** Returns the hex color for a category, falling back to "other" for unknowns. */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}

/** Returns the display label for a category, falling back to a capitalized version. */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? (category ? category[0].toUpperCase() + category.slice(1) : "Other");
}
