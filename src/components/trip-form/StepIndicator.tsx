export const STEPS = ["Trip details", "Destinations", "Itinerary"];

export default function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex gap-2 justify-between mb-5">
      {STEPS.map((label, i) => {
        const number = i + 1;
        const status = number === currentStep ? "active" : number < currentStep ? "done" : "";
        return (
          <div className={`flex items-center gap-2 text-muted-foreground text-xs font-semibold flex-1 ${status === "active" ? "text-foreground" : ""}`} key={label}>
            <span className={`w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center text-xs shrink-0 ${status === "active" ? "bg-primary border-primary text-primary-foreground" : status === "done" ? "border-primary text-primary" : ""}`}>
              {number < currentStep ? "✓" : number}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
