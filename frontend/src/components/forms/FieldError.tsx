interface FieldErrorProps {
  id: string;
  message?: string;
}

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="status" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
      {message}
    </p>
  );
}
