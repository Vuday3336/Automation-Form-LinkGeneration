import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { can } from '../lib/permissions.js';
import { STATUSES, formatDateTime } from '../lib/format.js';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import { inputClass } from '../components/ui/Form.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { Table, Td, Th } from '../components/ui/Table.jsx';

// Filters live in the URL (?status=Pending&page=2), so a filtered view can be bookmarked or shared
// and the browser's back button works as expected.
const FILTER_KEYS = ['search', 'status', 'department', 'hospitalId', 'submissionType'];

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const showPatient = can(user, 'viewPatientName');

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  const page = Number(params.get('page') ?? 1);
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';

  const query = Object.fromEntries(
    Object.entries({ ...filters, page, order, sortBy: 'submittedAt', limit: 15 }).filter(([, v]) => v !== '')
  );
  const { data, loading, error, reload } = useApi('/submissions', query);
  const hospitals = useApi('/hospitals');

  const update = (changes) => {
    const nextParams = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined) nextParams.delete(key);
      else nextParams.set(key, String(value));
    }
    if (!('page' in changes)) nextParams.delete('page'); // new filter → back to page 1
    setParams(nextParams, { replace: true });
  };

  // Debounce: wait until typing pauses for 300ms before searching.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchText !== (params.get('search') ?? '')) update({ search: searchText.trim() });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const hasFilters = FILTER_KEYS.some((k) => filters[k]);
  const facets = data?.facets ?? { departments: [], submissionTypes: [] };

  return (
    <>
      <PageHeader title="Submissions" description="Every Google Form response you have access to." />

      <Card bodyClassName="">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search ID, hospital, department…"
              className={`${inputClass} pl-9`}
            />
          </label>
          <select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })} className={inputClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Department" value={filters.department} onChange={(e) => update({ department: e.target.value })} className={inputClass}>
            <option value="">All departments</option>
            {facets.departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select aria-label="Submission type" value={filters.submissionType} onChange={(e) => update({ submissionType: e.target.value })} className={inputClass}>
            <option value="">All types</option>
            {facets.submissionTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select aria-label="Hospital" value={filters.hospitalId} onChange={(e) => update({ hospitalId: e.target.value })} className={inputClass}>
            <option value="">All hospitals</option>
            {(hospitals.data?.items ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
            <span className="text-slate-500">{data ? `${data.pagination.total} matching` : 'Filtering…'}</span>
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                setParams({}, { replace: true });
              }}
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          </div>
        )}

        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}

        {loading && !data ? (
          <LoadingState />
        ) : data?.items.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Submission ID</Th>
                  <Th>Hospital</Th>
                  {showPatient && <Th>Patient</Th>}
                  <Th>Department</Th>
                  <Th>Type</Th>
                  <Th>
                    <button
                      type="button"
                      onClick={() => update({ order: order === 'desc' ? 'asc' : 'desc', page })}
                      className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
                    >
                      Submitted {order === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </button>
                  </Th>
                  <Th>Status</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((item) => (
                  <tr key={item.submissionId} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs font-medium text-slate-900">{item.submissionId}</Td>
                    <Td>{item.hospitalId ? item.hospitalName : <span className="text-amber-700">{item.hospitalName} (unassigned)</span>}</Td>
                    {showPatient && <Td>{item.patientName ?? '—'}</Td>}
                    <Td>{item.department ?? '—'}</Td>
                    <Td>{item.submissionType ?? '—'}</Td>
                    <Td>{formatDateTime(item.submittedAt)}</Td>
                    <Td>
                      <StatusBadge status={item.status} />
                    </Td>
                    <Td className="text-right">
                      <Link to={`/submissions/${item.submissionId}`} className="font-medium text-brand-700 hover:text-brand-600">
                        View details
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...data.pagination} onPageChange={(p) => update({ page: p })} />
          </>
        ) : (
          <EmptyState title={hasFilters ? 'No submissions match these filters' : 'No submissions yet'} message={hasFilters ? 'Try removing a filter.' : 'Google Form responses will appear here automatically.'} />
        )}
      </Card>
    </>
  );
}
