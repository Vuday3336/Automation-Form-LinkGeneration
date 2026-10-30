import { Link } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, CheckCircle2, ClipboardCheck, Clock, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { can } from '../lib/permissions.js';
import { formatDate, timeAgo } from '../lib/format.js';
import { Card, PageHeader, StatCard } from '../components/ui/Card.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import { Table, Td, Th } from '../components/ui/Table.jsx';

const BRAND = '#0d9488';
const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useApi('/dashboard/stats');
  const departments = useApi('/dashboard/department-stats');
  const recent = useApi('/dashboard/recent-submissions');
  const showPatient = can(user, 'viewPatientName');

  const s = stats.data;
  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} description="Overview of form submissions across the hospitals you can access." />
      <ErrorBanner message={stats.error} onRetry={stats.reload} />

      {s?.unassigned > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {s.unassigned} submission{s.unassigned > 1 ? 's' : ''} didn't match a known hospital. Open one and assign a hospital.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total submissions" value={s?.total ?? '—'} icon={FileText} tone="brand" />
        <StatCard label="Pending" value={s?.byStatus.Pending ?? '—'} icon={Clock} tone="amber" hint={s ? `${s.byStatus['Under Review']} under review` : undefined} />
        <StatCard label="Approved" value={s?.byStatus.Approved ?? '—'} icon={CheckCircle2} tone="green" hint={s ? `${s.byStatus.Rejected} rejected` : undefined} />
        <StatCard label="Completed" value={s?.byStatus.Completed ?? '—'} icon={ClipboardCheck} tone="slate" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card title="Submission activity" description="New submissions per day, last 14 days" className="xl:col-span-3">
          {stats.loading ? (
            <LoadingState />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s?.activity ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip labelFormatter={shortDay} formatter={(value) => [value, 'Submissions']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2} fill="url(#activityFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="By department" description="Submissions per department" className="xl:col-span-2">
          {departments.loading ? (
            <LoadingState />
          ) : departments.data?.items.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments.data.items} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="department" width={92} tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [value, 'Submissions']} contentStyle={{ borderRadius: 8, fontSize: 12 }} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill={BRAND} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No data yet" />
          )}
        </Card>
      </div>

      <Card
        title="Recent submissions"
        className="mt-6"
        bodyClassName=""
        actions={
          <Link to="/submissions" className="text-sm font-medium text-brand-700 hover:text-brand-600">
            View all →
          </Link>
        }
      >
        {recent.loading ? (
          <LoadingState />
        ) : recent.data?.items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Submission</Th>
                <Th>Hospital</Th>
                {showPatient && <Th>Patient</Th>}
                <Th>Department</Th>
                <Th>Received</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.data.items.map((item) => (
                <tr key={item.submissionId} className="hover:bg-slate-50">
                  <Td>
                    <Link to={`/submissions/${item.submissionId}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                      {item.submissionId}
                    </Link>
                  </Td>
                  <Td>{item.hospitalName}</Td>
                  {showPatient && <Td>{item.patientName ?? '—'}</Td>}
                  <Td>{item.department ?? '—'}</Td>
                  <Td>
                    <span title={formatDate(item.submittedAt)}>{timeAgo(item.submittedAt)}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={item.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No submissions yet" message="New Google Form responses will appear here automatically." />
        )}
      </Card>
    </>
  );
}
