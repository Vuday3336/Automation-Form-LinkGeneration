import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from './api.js';

// Loads data from a GET endpoint and tracks loading / error state.
//   const { data, loading, error, status, reload } = useApi('/dashboard/stats');
// Re-fetches automatically when the URL or params change. Older responses that arrive late
// are ignored, so fast filter changes never show stale results.
export function useApi(url, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null, status: null });
  const latestRequest = useRef(0);
  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(async () => {
    if (!url) return;
    const requestId = ++latestRequest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.get(url, { params: JSON.parse(paramsKey) });
      if (requestId === latestRequest.current) setState({ data: res.data.data, loading: false, error: null, status: res.status });
    } catch (error) {
      if (requestId === latestRequest.current) {
        setState({ data: null, loading: false, error: getErrorMessage(error), status: error.response?.status ?? null });
      }
    }
  }, [url, paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}
