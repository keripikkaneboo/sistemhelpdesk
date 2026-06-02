"use client";

import { useState, useRef, useEffect } from "react";

export interface SelectOption { value: string; label: string; }
export interface SelectGroup  { label: string; options: SelectOption[]; }

interface Props {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

export default function CustomSelect({
  value, onChange, options = [], groups,
  placeholder = "Pilih...", disabled = false, size = "xs", className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOpts = groups ? groups.flatMap((g) => g.options) : options;
  const selected = allOpts.find((o) => o.value === value);

  const triggerSize = size === "sm" ? "py-2 text-sm" : "py-1.5 text-xs";
  const optSize    = size === "sm" ? "py-2 text-sm" : "py-1.5 text-xs";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 ${triggerSize} bg-white outline-none focus:ring-2 focus:ring-red-300 transition ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-300"
        } ${className}`}
      >
        <span className={`truncate ${selected && selected.value !== "" ? "text-gray-700" : "text-gray-400"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {groups && groups.length > 0 ? (
              groups.map((g) => (
                <div key={g.label}>
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    {g.label}
                  </div>
                  {g.options.map((o) => (
                    <button
                      key={o.value} type="button"
                      onClick={() => { onChange(o.value); setOpen(false); }}
                      className={`w-full text-left px-3 ${optSize} transition ${
                        o.value === value
                          ? "bg-red-50 text-red-600 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              options.map((o) => (
                <button
                  key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 ${optSize} transition ${
                    o.value === value
                      ? "bg-red-50 text-red-600 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
