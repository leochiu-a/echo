import { type KeyboardEvent, useCallback } from "react";
import { cn, tokenizeShortcut } from "../dashboard-shared";
import { buildShortcutFromKeydown } from "./keyboard-shortcut";

interface KeyboardShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}

export function KeyboardShortcutInput({
  value,
  onChange,
  ariaLabel,
  className,
  placeholder = "Press shortcut keys",
}: KeyboardShortcutInputProps) {
  const hasValue = Boolean(value.trim());
  const tokens = hasValue ? tokenizeShortcut(value) : [];

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const nextShortcut = buildShortcutFromKeydown(event);
      if (nextShortcut === null) {
        return;
      }

      event.preventDefault();
      onChange(nextShortcut);
    },
    [onChange],
  );

  return (
    <div className="relative">
      <input
        type="text"
        aria-label={ariaLabel}
        className={cn(
          className,
          "cursor-default text-transparent caret-transparent selection:bg-transparent",
        )}
        value={value}
        readOnly
        spellCheck={false}
        autoComplete="off"
        onKeyDown={onKeyDown}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center gap-1.5 overflow-x-auto px-3.5">
        {tokens.length > 0 ? (
          tokens.map((token, index) => (
            <span
              key={`${token}-${index}`}
              className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-xl border border-black/10 bg-white/70 px-2.5 py-1 text-xs font-semibold uppercase text-[#21333d]"
            >
              {token}
            </span>
          ))
        ) : (
          <span className="text-sm font-medium text-[#4f616e]/70">{placeholder}</span>
        )}
      </div>
    </div>
  );
}
