import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface ThemedSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  placement?: 'above' | 'below';
  disabled?: boolean;
}

export function ThemedSelect({
  label,
  value,
  options,
  onChange,
  placement = 'below',
  disabled = false,
}: ThemedSelectProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [active, setActive] = useState(selected);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : !open
              ? selected
              : Math.max(
                  0,
                  Math.min(options.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)),
                );
      setActive(next);
      setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else {
        setActive(selected);
        setOpen(true);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    } else if (event.key === 'Tab') setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text =
        (now - typeahead.current.time > 700 ? '' : typeahead.current.text) +
        event.key.toLowerCase();
      typeahead.current = { text, time: now };
      const match = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (match >= 0) {
        event.preventDefault();
        setActive(match);
        setOpen(true);
      }
    }
  }

  return (
    <div
      ref={container}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        disabled={disabled}
        onKeyDown={handleKey}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-teal-400 hover:bg-teal-50/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-500/60 dark:hover:bg-teal-500/10"
      >
        <span className="truncate">{options[selected]?.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label={label}
          className={`select-options absolute left-0 z-40 max-h-[min(24rem,50dvh)] w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 ${placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {options.map((option, index) => (
            <div
              id={`${id}-option-${index}`}
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              className={`flex min-h-10 cursor-pointer items-center justify-between gap-4 rounded-lg px-3 text-xs font-semibold transition-colors ${index === active ? 'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200' : 'text-slate-600 dark:text-slate-300'}`}
            >
              <span>{option.label}</span>
              {value === option.value ? (
                <Check aria-hidden="true" className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              ) : (
                <span className="w-4" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
