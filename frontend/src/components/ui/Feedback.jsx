import { Link } from 'react-router';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-900">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, showHome = true }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
      {showHome && (
        <Link to="/" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Back to dashboard
        </Link>
      )}
    </div>
  );
}
