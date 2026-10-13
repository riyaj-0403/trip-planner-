import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { getCategoryColor, getCategoryLabel } from "../constants/categories";

interface Props {
  data: Record<string, number>;
  currency: string;
  totalBudget: number;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function DonutTooltip({ active, payload, currency, total }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  if (!name || value == null) return null;
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-0.5 shadow-md">
      <span className="text-xs font-semibold text-foreground">{getCategoryLabel(name)}</span>
      <span className="text-sm text-foreground font-bold">{currency} {value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CategoryDonutChart({ data, currency, totalBudget }: Props) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const isOverBudget = totalBudget > 0 && total > totalBudget;

  // Filter and sort slices by amount descending
  const slices = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, value]) => ({ name: cat, value }));

  // Empty state: single gray ring
  const isEmpty = total === 0;
  const pieData = isEmpty ? [{ name: "empty", value: 1 }] : slices;

  // Accessibility: build aria-label from slices
  const ariaLabel = isEmpty
    ? "Spending by category: No spending yet"
    : `Spending by category: ${slices
        .map((s) => `${getCategoryLabel(s.name)} ${total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%`)
        .join(", ")}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Chart wrapper with explicit height so ResponsiveContainer renders */}
      <div
        className="relative h-64 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Centered text inside the donut hole */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1/5 max-w-xs mx-auto" aria-hidden="true">
          {isEmpty ? (
            <span className="text-xs text-muted-foreground leading-relaxed">No spending yet</span>
          ) : (
            <>
              <span className="text-xs text-muted-foreground leading-relaxed">Total spent</span>
              <span className={`text-lg font-bold leading-snug ${isOverBudget ? "text-destructive" : "text-foreground"}`}>
                {currency} {total.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">of {currency} {totalBudget.toLocaleString()}</span>
              {isOverBudget && (
                <span className="text-xs text-destructive font-semibold mt-0.5">Over budget</span>
              )}
            </>
          )}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius="65%"
              outerRadius="95%"
              paddingAngle={isEmpty ? 0 : 2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={600}
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={isEmpty ? "#E5E7EB" : getCategoryColor(entry.name)}
                />
              ))}
            </Pie>
            {!isEmpty && (
              <Tooltip
                content={
                  <DonutTooltip currency={currency} total={total} />
                }
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend – sorted descending, color + label + amount + pct */}
      {!isEmpty && (
        <ul className="list-none m-0 p-0 flex flex-col gap-2" aria-label="Chart legend">
          {slices.map((s) => {
            const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0";
            return (
              <li key={s.name} className="grid gap-2 items-center text-xs grid-cols-4 sm:grid-cols-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: getCategoryColor(s.name) }}
                  aria-hidden="true"
                />
                <span className="text-foreground font-medium">{getCategoryLabel(s.name)}</span>
                <span className="text-foreground font-semibold whitespace-nowrap">
                  {currency} {s.value.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-xs whitespace-nowrap min-w-9 text-right">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
