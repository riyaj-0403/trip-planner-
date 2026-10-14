import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface Props {
  state: "loading" | "notfound" | "error";
  message?: string;
  onBack: () => void;
}

/** Full-page loading / not found / error screens shown while the trip loads in edit mode. */
export default function TripLoadState({ state, message, onBack }: Props) {
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin size-5" />
          <span>Loading trip...</span>
        </div>
      </div>
    );
  }

  const title = state === "notfound" ? "Trip not found" : "Error loading trip";
  const body =
    state === "notfound" ? "This trip doesn't exist or may have been deleted." : message;

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card className="flex gap-3 items-start p-4 border-destructive/30 bg-destructive/10 shadow-none">
        <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-destructive">{title}</h2>
          <p className="text-sm text-muted-foreground">{body}</p>
          <Button onClick={onBack} className="w-fit">
            Back to trips
          </Button>
        </div>
      </Card>
    </div>
  );
}
