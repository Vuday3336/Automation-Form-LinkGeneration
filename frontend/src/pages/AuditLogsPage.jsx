import { useState } from 'react';
import { Link } from 'react-router';
import { useApi } from '../lib/useApi.js';
import { AUDIT_ACTION_LABELS, formatDateTime } from '../lib/format.js';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import { inputClass } from '../components/ui/Form.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { Table, Td, Th } from '../components/ui/Table.jsx';

const toneFor = (action) => {
  if (/denied|failed|rejected/.test(action)) return 'red';
  if (/revoked|archived/.test(action)) return 'amber';
  if (/received|created|login$/.test(action)) return 'green';
  return 'slate';
};

// Readable summary of the metadata (which never contains patient data).
function describe(log) {
  const m = log.metadata ?? {};
  if (m.from && m.to) return `${m.from} → ${m.to}`;
  if (m.reason) return `Reason: ${m.reason.replaceAll('_', ' ')}`;
  if (m.via) return `Via ${m.via.replace('_', ' ')}`;
  if (m.changes) return `Changed: ${Object.keys(m.changes).join(', ')}`;
  if (m.fields) return `Fields: ${m.fields.join(', ')}`;
  if (m.hospitalMatched === false) return 'Hospital not matched';
  if (m.role) return `Role: ${m.role.replace('_', ' ')}`;
  return '';
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [page, setPage] = useState(1);
  const params = Object.fromEntries(Object.entries({ action, submissionId: submissionId.trim(), page, limit: 25 }).filter(([, v]) => v !== ''));
  const { data, loading, error, reload } = useApi('/audit-logs', params);

  return (
    <>
      <PageHeader title="Audit logs" description="Who did what, and when. Patient and medical details are never recorded here." />
      <Card bodyClassName="">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:w-2/3">
          <select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            aria-label="Submission ID"
            placeholder="Filter by submission ID (HF-…)"
            value={submissionId}
            onChange={(e) => { setSubmissionId(e.target.value); setPage(1); }}
            className={inputClass}
          />
        </div>
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={reload} /></div>}
        {loading && !data ? (
          <LoadingState />
        ) : data?.items.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Action</Th>
                  <Th>User</Th>
                  <Th>Submission</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <Td className="text-slate-500">{formatDateTime(log.timestamp)}</Td>
                    <Td><Badge tone={toneFor(log.action)}>{AUDIT_ACTION_LABELS[log.action] ?? log.action}</Badge></Td>
                    <Td>{log.userName ?? <span className="text-slate-400">System</span>}</Td>
                    <Td>
                      {log.submissionId ? (
                        <Link to={`/submissions/${log.submissionId}`} className="font-mono text-xs text-brand-700 hover:underline">{log.submissionId}</Link>
                      ) : '—'}
                    </Td>
                    <Td className="text-slate-500">{describe(log)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...data.pagination} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="No audit entries match" />
        )}
      </Card>
    </>
  );
}
