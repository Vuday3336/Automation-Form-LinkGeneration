const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '—');
export const formatDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : '—');

export function timeAgo(value) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(-seconds, 'second');
  if (abs < 3600) return rtf.format(-Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86400), 'day');
}

// Form answers can be text, numbers, lists (checkboxes) or lists of lists (grids).
export function formatAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return '—';
  if (Array.isArray(answer)) return answer.map((a) => (Array.isArray(a) ? a.join(', ') : a)).join('; ');
  return String(answer);
}

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  hospital_admin: 'Hospital Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

export const AUDIT_ACTION_LABELS = {
  'submission.received': 'Submission received',
  'submission.duplicate_ignored': 'Duplicate ignored',
  'submission.viewed': 'Submission viewed',
  'submission.updated': 'Submission updated',
  'submission.status_changed': 'Status changed',
  'submission.archived': 'Submission archived',
  'submission.access_denied': 'Access denied',
  'link.created': 'Link created',
  'link.revoked': 'Link revoked',
  'link.access_denied': 'Link access denied',
  'auth.login': 'Logged in',
  'auth.login_failed': 'Login failed',
  'auth.password_changed': 'Password changed',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'hospital.created': 'Hospital created',
  'hospital.updated': 'Hospital updated',
  'integration.rejected': 'Integration rejected',
};

export const STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'];
