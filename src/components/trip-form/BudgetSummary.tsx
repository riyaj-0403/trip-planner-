import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";
import type { ActivityDraft } from "../../types/tripForm";

interface Props {
  activities: Record<string, ActivityDraft[]>;
  currency: string;
  totalBudget: string;
}

export default function BudgetSummary({ activities, currency, totalBudget }: Props) {
  const { totalSpent, spentByCategory, remainingBudget } = useMemo(() => {
    const flat = Object.values(activities).flat();
    const spent = flat.reduce((s, a) => s + Number(a.cost || 0), 0);
    const byCategory: Record<string, number> = {};
    flat.forEach((a) => {
      if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + Number(a.cost || 0);
    });
    return {
      totalSpent: spent,
      spentByCategory: byCategory,
      remainingBudget: Number(totalBudget || 0) - spent,
    };
  }, [activities, totalBudget]);

  const withinBudget = remainingBudget >= 0;

  return (
    <Card
      className={cn(
        "px-3.5 py-3 flex flex-col gap-2.5 shadow-none",
        withinBudget
          ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
          : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex justify-between text-xs font-semibold text-foreground">
        <span>Total Spent:</span>
        <span className="text-foreground font-bold">{currency} {totalSpent.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs font-semibold text-foreground">
        <span>Budget:</span>
        <span className="text-foreground font-bold">{currency} {Number(totalBudget).toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs font-semibold text-foreground">
        <span>Remaining:</span>
        <span className={cn("text-foreground font-bold", !withinBudget && "text-destructive")}>
          {currency} {remainingBudget.toLocaleString()}
        </span>
      </div>
      {Object.entries(spentByCategory).length > 0 && (
        <div
          className={cn(
            "pt-2 border-t flex flex-col gap-1.5",
            withinBudget
              ? "border-green-200/50 dark:border-green-900/30"
              : "border-red-200/50 dark:border-red-900/30"
          )}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase">By Category:</span>
          {Object.entries(spentByCategory).map(([cat, amount]) => (
            <div key={cat} className="flex justify-between text-xs text-muted-foreground">
              <span className="capitalize">{cat}</span>
              <span className="font-medium text-foreground">{currency} {amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
