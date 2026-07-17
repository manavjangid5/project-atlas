import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "./searchApi";
import type { SearchResult } from "./searchApi";

const TYPE_ROUTES: Record<string, string> = {
  workflow: "/dashboard/workflows",
  form: "/dashboard/forms",
  rule: "/dashboard/rules",
  file: "/dashboard/files",
  member: "/dashboard/members",
};

const TYPE_ICONS: Record<string, string> = {
  workflow: "⚙", form: "📋", rule: "🔀", file: "📎", member: "👤",
};

export default function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      globalSearch(query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250); // debounce
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    navigate(TYPE_ROUTES[result.type] || "/dashboard");
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative w-72" ref={wrapperRef}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search workflows, forms, files…"
        className="w-full bg-surface border border-border rounded-pill px-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-surface border border-border rounded-md shadow-xl z-50 max-h-80 overflow-auto">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-surfaceHover flex items-center gap-2"
            >
              <span>{TYPE_ICONS[r.type]}</span>
              <div>
                <p className="text-sm">{r.title}</p>
                <p className="text-xs text-muted">{r.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}