import { useEffect, useMemo, useRef, useState } from "react";

import {
  loadCitySearchIndex,
  searchCityIndex,
  type CitySearchEntry,
} from "./citySearchIndex.ts";

export function CitySearchBox({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (entry: CitySearchEntry) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Awaited<ReturnType<typeof loadCitySearchIndex>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    inputRef.current?.focus();

    loadCitySearchIndex()
      .then((value) => {
        setIndex(value);
        setError(null);
      })
      .catch((err) => {
        console.error("City search index load failed:", err);
        setError("城市索引加载失败");
      });
  }, [open]);

  const results = useMemo(() => searchCityIndex(index, query), [index, query]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  return (
    <div
      className={`overflow-hidden transition-all duration-200 ease-out ${
        open ? "w-72 opacity-100" : "w-0 opacity-0"
      }`}
    >
      {open && (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, Math.max(results.length - 1, 0)),
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                onSelect(results[activeIndex]);
              }
            }}
            placeholder="搜索全国城市"
            className="w-full rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white outline-none backdrop-blur-md placeholder:text-neutral-500"
          />

          <div className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[rgba(8,16,24,0.94)] shadow-2xl">
            {error ? (
              <div className="px-4 py-3 text-sm text-amber-200">{error}</div>
            ) : query.trim().length === 0 ? (
              <div className="px-4 py-3 text-sm text-neutral-400">输入城市名开始搜索</div>
            ) : results.length > 0 ? (
              results.map((item, index) => (
                <button
                  key={item.cityId}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(item);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                    index === activeIndex
                      ? "bg-white/10 text-white"
                      : "text-neutral-200 hover:bg-white/5"
                  }`}
                >
                  <span>{item.cityName}</span>
                  <span className="text-xs text-neutral-400">{item.provinceName}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-neutral-400">未找到匹配城市</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
