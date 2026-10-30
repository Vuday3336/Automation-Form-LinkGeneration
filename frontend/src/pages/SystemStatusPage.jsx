import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api.js';

// Phase 1 landing page: proves the full chain Browser → Vite → Express works.
export default function SystemStatusPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const checkHealth = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const res = await api.get('/health');
      setState({ loading: false, data: res.data.data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Activity className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">HospitalForm AI</h1>
          <p className="text-sm text-slate-500">Setup check: Phase 1</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Backend API</h2>
            <p className="mt-1 text-sm text-slate-500">GET /api/health</p>
          </div>
          <StatusBadge loading={state.loading} ok={Boolean(state.data)} />
        </div>

        {state.data && (
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">Database (Supabase)</dt>
            <dd className="font-medium">{state.data.database}</dd>
            <dt className="text-slate-500">Environment</dt>
            <dd className="font-medium">{state.data.environment}</dd>
            <dt className="text-slate-500">Server time</dt>
            <dd className="font-medium">{new Date(state.data.time).toLocaleString()}</dd>
          </dl>
        )}

        {state.error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {state.error}. Is the backend running? Start it with <code>npm run dev</code> inside{' '}
            <code>backend/</code>.
          </p>
        )}

        <button
          type="button"
          onClick={checkHealth}
          disabled={state.loading}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check again
        </button>
      </section>
    </main>
  );
}

function StatusBadge({ loading, ok }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking
      </span>
    );
  }
  return ok ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Offline
    </span>
  );
}
