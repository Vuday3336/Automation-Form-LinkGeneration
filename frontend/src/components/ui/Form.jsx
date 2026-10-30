import { forwardRef, useId } from 'react';

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500';

// Label + input + error message, wired together for screen readers.
export function Field({ label, error, hint, children, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// forwardRef lets React Hook Form's register() attach to the real <input>.
export const Input = forwardRef(function Input({ label, error, hint, className = '', ...props }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, children, className = '', ...props }, ref) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <select ref={ref} id={id} aria-invalid={Boolean(error)} className={`${inputClass} pr-8 ${className}`} {...props}>
        {children}
      </select>
    </Field>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, ...props }, ref) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input ref={ref} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
      {label}
    </label>
  );
});

export { inputClass };
