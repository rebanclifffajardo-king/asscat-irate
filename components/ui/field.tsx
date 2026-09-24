import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-md border border-gray-300 bg-white px-3 text-[15px] text-gray-900 shadow-xs " +
  "placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 " +
  "disabled:bg-gray-100 disabled:text-gray-500 aria-[invalid=true]:border-lte-danger aria-[invalid=true]:ring-lte-danger/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-2", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, "h-10 pr-8 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-brand-500" {...props} />
      {label}
    </label>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string | string[];
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error with accessible wiring (pass aria-describedby={`${htmlFor}-msg`}). */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-lte-danger" aria-hidden>*</span>}
      </label>
      {children}
      {message ? (
        <p id={`${htmlFor}-msg`} className="text-xs font-medium text-lte-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-msg`} className="text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
