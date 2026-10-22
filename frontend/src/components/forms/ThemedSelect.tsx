import { useCopy } from '../../lib/i18n';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown, Languages, LoaderCircle } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface SelectOption {
  value: string;
  label: string;
  translate?: boolean;
}

interface ThemedSelectProps {
  label: string;
  labelId?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placement?: 'above' | 'below';
  disabled?: boolean;
  compact?: boolean;
  size?: 'default' | 'small';
  tooltip?: string;
  busy?: boolean;
}

export function ThemedSelect({
  label,
  labelId,
  value,
  options,
  onChange,
  placement = 'below',
  disabled = false,
  compact = false,
  size = 'default',
  tooltip,
  busy = false,
}: ThemedSelectProps) {
  const c = useCopy();

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
  const optionLabel = (option?: SelectOption) =>
    option?.translate === false ? option.label : c(option?.label);

  useEffect(() => {
    if (!open) return undefined;
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
      const match = options.findIndex((option) =>
        optionLabel(option).toLowerCase().startsWith(text),
      );
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
      <Tooltip label={tooltip ?? label} triggerRef={trigger}>
        <button
          type="button"
          role="combobox"
          aria-label={labelId ? undefined : c(label)}
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-busy={busy || undefined}
          aria-controls={`${id}-options`}
          aria-activedescendant={open ? `${id}-option-${active}` : undefined}
          disabled={disabled}
          onKeyDown={handleKey}
          onClick={() => {
            setActive(selected);
            setOpen(!open);
          }}
          className={`flex ${compact ? 'h-10 w-20 gap-1 px-2.5' : size === 'small' ? 'h-10 w-full gap-2 px-3' : 'h-11 w-full gap-3 px-3.5'} items-center justify-between rounded-xl border border-slate-200 bg-white text-left text-xs font-semibold text-slate-700 shadow-xs hover:border-teal-400 hover:bg-teal-50/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-500/60 dark:hover:bg-teal-500/10`}
        >
          {compact &&
            (busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Languages aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ))}
          <span className="truncate">{optionLabel(options[selected])}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </Tooltip>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label={c(label)}
          className={`select-options absolute ${compact ? 'right-0' : 'left-0'} z-40 max-h-[min(24rem,50dvh)] w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 ${placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
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
              <span>{optionLabel(option)}</span>
              {value === option.value ? (
                <Check aria-hidden="true" className="h-4 w-4 text-teal-700 dark:text-teal-400" />
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
