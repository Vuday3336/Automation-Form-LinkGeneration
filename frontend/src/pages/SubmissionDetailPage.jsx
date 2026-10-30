import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, ArrowLeft, Ban, Link2, Lock, Pencil, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { STATUSES, formatAnswer, formatDateTime } from '../lib/format.js';
import { Card, DetailList } from '../components/ui/Card.jsx';
import { Badge, LinkStateBadge, StatusBadge } from '../components/ui/Badge.jsx';
import { ErrorBanner, ErrorState, LoadingState } from '../components/ui/Feedback.jsx';
import { Input, Select, inputClass } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import CopyButton from '../components/ui/CopyButton.jsx';
import Modal from '../components/ui/Modal.jsx';

// One page for two URLs:
//   /submissions/:submissionId       opened from the dashboard
//   /submissions/secure/:token       opened from a generated secure link
export default function SubmissionDetailPage() {
  const { submissionId, token } = useParams();
  const url = token ? `/submissions/secure/${token}` : `/submissions/${submissionId}`;
  const { data, loading, error, status, setData } = useApi(url);

  if (loading && !data) return <LoadingState label="Loading submission…" />;
  if (error) {
    const titles = { 403: 'Access denied', 404: 'Not found', 410: token ? 'Link no longer valid' : 'Not available' };
    return <ErrorState title={titles[status] ?? 'Could not load submission'} message={error} />;
  }
  return <SubmissionDetail detail={data} viaLink={Boolean(token)} onChange={setData} />;
}

function SubmissionDetail({ detail, viaLink, onChange }) {
  const { submission: s, statusHistory, permissions } = detail;
  const [actionError, setActionError] = useState('');

  return (
    <>
      <Link to="/submissions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All submissions
      </Link>

      {viaLink && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          <ShieldCheck className="h-4 w-4" /> Opened through a secure link. Your access was verified.
        </div>
      )}
      {s.archivedAt && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
          Archived on {formatDateTime(s.archivedAt)}. It's read-only and hidden from lists.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-semibold text-slate-900 sm:text-2xl">{s.submissionId}</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {s.hospitalName} · received {formatDateTime(s.submittedAt)}
          </p>
        </div>
        <CopyButton value={s.submissionId} label="Copy ID" />
      </div>

      <ErrorBanner message={actionError} />

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Overview">
            <DetailList
              items={[
                { label: 'Hospital', value: s.hospitalId ? s.hospitalName : <span className="text-amber-700">{s.hospitalName} (unassigned)</span> },
                { label: 'Department', value: s.department ?? '—' },
                { label: 'Submission type', value: s.submissionType ?? '—' },
                { label: 'Submitted', value: formatDateTime(s.submittedAt) },
                {
                  label: 'Patient',
                  value: s.patientNameRestricted ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <Lock className="h-3.5 w-3.5" /> Restricted for your role
                    </span>
                  ) : (
                    s.patientName ?? '—'
                  ),
                },
                { label: 'Source form', value: s.formTitle ?? 'Google Form' },
              ]}
            />
          </Card>

          <Card title="Form answers" description={`${s.answers.length} question${s.answers.length === 1 ? '' : 's'}`} bodyClassName="">
            <dl className="divide-y divide-slate-100">
              {s.answers.map((a, i) => (
                <div key={`${a.question}-${i}`} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
                  <dt className="text-sm font-medium text-slate-500">{a.question}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-slate-900 sm:col-span-2">{formatAnswer(a.answer)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          {(permissions.canUpdateStatus || permissions.canEdit || permissions.canArchive) && (
            <ActionsCard submission={s} permissions={permissions} onChange={onChange} onError={setActionError} />
          )}
          <LinkCard submission={s} canManage={permissions.canManageLinks} onChange={onChange} onError={setActionError} />
          <Card title="Status history">
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {statusHistory.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
                  <StatusBadge status={h.status} />
                  <p className="mt-1 text-xs text-slate-500">
                    {h.from ? `from ${h.from} · ` : ''}by {h.changedBy}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function ActionsCard({ submission: s, permissions, onChange, onError }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(s.status);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const run = async (fn) => {
    onError('');
    setSaving(true);
    try {
      await fn();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = () =>
    run(async () => {
      const res = await api.patch(`/submissions/${s.submissionId}/status`, { status });
      onChange(res.data.data);
    });

  const archive = () =>
    run(async () => {
      await api.delete(`/submissions/${s.submissionId}`);
      navigate('/submissions', { replace: true });
    });

  return (
    <Card title="Actions">
      {permissions.canUpdateStatus && (
        <div className="flex gap-2">
          <select aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {STATUSES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <Button onClick={saveStatus} loading={saving} disabled={status === s.status}>
            Update
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {permissions.canEdit && (
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
            Edit details
          </Button>
        )}
        {permissions.canArchive && (
          <Button variant="secondary" size="sm" icon={Archive} onClick={() => setArchiveOpen(true)}>
            Archive
          </Button>
        )}
      </div>

      <EditModal open={editOpen} submission={s} onClose={() => setEditOpen(false)} onSaved={(detail) => { onChange(detail); setEditOpen(false); }} />

      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive this submission?"
        description="It will be hidden from lists and its secure link revoked. The record is kept for auditing and is never permanently deleted."
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={saving} onClick={archive}>Archive</Button>
          </>
        }
      >
        <p className="font-mono text-sm text-slate-700">{s.submissionId}</p>
      </Modal>
    </Card>
  );
}

const editSchema = z.object({
  department: z.string().trim().min(1, 'Required').max(120),
  submissionType: z.string().trim().min(1, 'Required').max(120),
  hospitalId: z.string(),
});

function EditModal({ open, submission: s, onClose, onSaved }) {
  const hospitals = useApi(open ? '/hospitals' : null);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(editSchema),
    values: { department: s.department ?? '', submissionType: s.submissionType ?? '', hospitalId: s.hospitalId ?? '' },
  });

  const onSubmit = async (values) => {
    setServerError('');
    const changes = {};
    if (values.department !== (s.department ?? '')) changes.department = values.department;
    if (values.submissionType !== (s.submissionType ?? '')) changes.submissionType = values.submissionType;
    if (values.hospitalId && values.hospitalId !== s.hospitalId) changes.hospitalId = values.hospitalId;
    if (Object.keys(changes).length === 0) return onClose();
    try {
      const res = await api.patch(`/submissions/${s.submissionId}`, changes);
      onSaved(res.data.data);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit submission details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-submission" loading={isSubmitting}>Save changes</Button>
        </>
      }
    >
      <form id="edit-submission" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner message={serverError} />
        <Select label="Hospital" {...register('hospitalId')} hint="Assigning a hospital makes the submission visible to that hospital's team.">
          {!s.hospitalId && <option value="">Unassigned: {s.hospitalName}</option>}
          {(hospitals.data?.items ?? []).filter((h) => h.isActive).map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </Select>
        <Input label="Department" error={errors.department?.message} {...register('department')} />
        <Input label="Submission type" error={errors.submissionType?.message} {...register('submissionType')} />
      </form>
    </Modal>
  );
}

function LinkCard({ submission: s, canManage, onChange, onError }) {
  const [newLink, setNewLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    onError('');
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () =>
    act(async () => {
      const res = await api.post(`/submissions/${s.submissionId}/link`);
      setNewLink(res.data.data);
      const detail = await api.get(`/submissions/${s.submissionId}`);
      onChange(detail.data.data);
    });

  const revoke = () =>
    act(async () => {
      await api.delete(`/submissions/${s.submissionId}/link`);
      setNewLink(null);
      const detail = await api.get(`/submissions/${s.submissionId}`);
      onChange(detail.data.data);
    });

  return (
    <Card title="Secure link" actions={<LinkStateBadge state={s.link.state} />}>
      <p className="text-sm text-slate-600">
        {s.link.state === 'valid' && `Works until ${formatDateTime(s.link.expiresAt)}.`}
        {s.link.state === 'expired' && `Expired on ${formatDateTime(s.link.expiresAt)}.`}
        {s.link.state === 'revoked' && `Revoked on ${formatDateTime(s.link.revokedAt)}.`}
        {s.link.state === 'none' && 'No link has been issued.'}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Links only identify the submission. Opening one still requires login and access to this hospital.
      </p>

      {newLink && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <Link2 className="h-3.5 w-3.5" /> New link: copy it now, it won't be shown again
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs text-slate-700">{newLink.secureUrl}</code>
            <CopyButton value={newLink.secureUrl} />
          </div>
        </div>
      )}

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy} onClick={regenerate}>
            {s.link.state === 'valid' ? 'Replace link' : 'Generate new link'}
          </Button>
          {s.link.state === 'valid' && (
            <Button variant="secondary" size="sm" icon={Ban} disabled={busy} onClick={revoke}>
              Revoke
            </Button>
          )}
        </div>
      )}
      {!canManage && s.link.state !== 'valid' && <Badge tone="slate">Ask an admin for a new link</Badge>}
    </Card>
  );
}
