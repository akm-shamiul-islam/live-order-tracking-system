import { useState, type ChangeEvent } from 'react';
import type { ZodType } from 'zod';

export type FieldErrors = Record<string, string>;

export function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
  for (const name of Object.keys(errors)) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      // Server errors arrive while the submitting form is still disabled.
      if ('disabled' in field && field.disabled) requestAnimationFrame(() => field.focus());
      else field.focus();
      return;
    }
  }
}

export function useZodForm<T extends Record<string, string>>(
  schema: ZodType<T>,
  initialValues: T,
  idPrefix: string,
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validateField(name: keyof T & string, nextValues: T) {
    const result = schema.safeParse(nextValues);
    const message = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === name)?.message;
    setErrors((previous) => {
      const next = { ...previous };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  function field(name: keyof T & string) {
    return {
      id: `${idPrefix}-${name}`,
      name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const next = { ...values, [name]: event.target.value };
        setValues(next);
        if (errors[name]) validateField(name, next);
      },
      onBlur: () => validateField(name, values),
      'aria-invalid': errors[name] ? true : undefined,
      'aria-describedby': errors[name] ? `${idPrefix}-${name}-error` : undefined,
    };
  }

  function setValue(name: keyof T & string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    setErrors((previous) => {
      const nextErrors = { ...previous };
      delete nextErrors[name];
      return nextErrors;
    });
  }

  function validate(form: HTMLFormElement): T | null {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const nextErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const name = issue.path.join('.');
      if (!nextErrors[name]) nextErrors[name] = issue.message;
    }
    setErrors(nextErrors);
    focusFirstError(form, nextErrors);
    return null;
  }

  function setServerErrors(nextErrors: FieldErrors, form: HTMLFormElement) {
    const relevant = Object.fromEntries(
      Object.entries(nextErrors).filter(([name]) => Object.hasOwn(values, name)),
    );
    setErrors(relevant);
    focusFirstError(form, relevant);
  }

  function reset() {
    setValues(initialValues);
    setErrors({});
  }

  return { values, errors, field, setValue, validate, setServerErrors, reset };
}
