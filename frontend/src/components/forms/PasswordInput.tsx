import { useId, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useCopy } from '../../lib/i18n';
import { Tooltip } from '../ui/Tooltip';
import { formInput } from '../ui/formStyles';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

export function PasswordInput({ id, className, disabled, ...props }: PasswordInputProps) {
  const c = useCopy();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const label = c(visible ? 'Hide Password' : 'Show Password');
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        {...props}
        id={inputId}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={twMerge(className ?? formInput, 'pr-12')}
      />
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-controls={inputId}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-teal-500/10 dark:hover:text-teal-200"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}
