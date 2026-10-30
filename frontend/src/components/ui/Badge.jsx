import { ROLE_LABELS } from '../../lib/format.js';

const STATUS_STYLES = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Under Review': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  Completed: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

export function Badge({ tone = 'slate', children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] ?? TONES.slate}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

export function RoleBadge({ role }) {
  const tone = { super_admin: 'brand', hospital_admin: 'amber', staff: 'green', viewer: 'slate' }[role];
  return <Badge tone={tone}>{ROLE_LABELS[role] ?? role}</Badge>;
}

const LINK_STATES = {
  valid: ['green', 'Active'],
  expired: ['amber', 'Expired'],
  revoked: ['red', 'Revoked'],
  none: ['slate', 'No link'],
};

export function LinkStateBadge({ state }) {
  const [tone, label] = LINK_STATES[state] ?? LINK_STATES.none;
  return <Badge tone={tone}>{label}</Badge>;
}
