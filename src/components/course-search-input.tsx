import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface CourseSearchInputProps {
  initialQuery: string;
  onSearchChange: (query: string) => void;
}

export function CourseSearchInput({ initialQuery, onSearchChange }: CourseSearchInputProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearchChange]);

  return (
    <div className="bg-background sticky top-0 z-10 shrink-0 border-b p-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          placeholder="Buscar por código o nombre..."
          className="h-9 pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </div>
  );
}
