import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface Props {
  onRestore: () => void;
  onDiscard: () => void;
}

export default function DraftBanner({ onRestore, onDiscard }: Props) {
  return (
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-muted px-4 py-3 text-sm shadow-none">
      <span>You have unsaved changes from earlier. Restore them?</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onRestore}>Restore</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDiscard}>Discard</Button>
      </div>
    </Card>
  );
}
