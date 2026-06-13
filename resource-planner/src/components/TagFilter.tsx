import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";

interface Props {
  allTags: string[];
  selected: Set<string>;
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({ allTags, selected, onToggle, onClear }: Props) {
  if (allTags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
      <button
        onClick={onClear}
        className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
          selected.size === 0
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        All
      </button>
      {allTags.map((tag) => (
        <Badge
          key={tag}
          variant={selected.has(tag) ? "default" : "outline"}
          className="cursor-pointer select-none"
          onClick={() => onToggle(tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
