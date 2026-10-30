import { query } from '../config/db.js';
import { listSubmissions } from '../models/Submission.js';
import { can, hospitalScope } from '../middleware/roleMiddleware.js';

// Every dashboard number respects hospital isolation: $1 is null for Super Admins
// (all hospitals) or the user's list of hospital IDs.
const SCOPE = 'archived_at is null and ($1::uuid[] is null or hospital_id = any($1::uuid[]))';

export async function getStats(user) {
  const scope = hospitalScope(user);
  const [totals, activity] = await Promise.all([
    query(
      `select count(*)::int as total,
         count(*) filter (where status = 'Pending')::int as pending,
         count(*) filter (where status = 'Under Review')::int as under_review,
         count(*) filter (where status = 'Approved')::int as approved,
         count(*) filter (where status = 'Rejected')::int as rejected,
         count(*) filter (where status = 'Completed')::int as completed,
         count(*) filter (where hospital_id is null)::int as unassigned
       from submissions where ${SCOPE}`,
      [scope]
    ),
    // One row per day for the last 14 days, including days with zero submissions.
    query(
      `select to_char(d.day, 'YYYY-MM-DD') as date, coalesce(c.count, 0)::int as count
       from generate_series(current_date - 13, current_date, interval '1 day') as d(day)
       left join (
         select (submitted_at at time zone 'UTC')::date as day, count(*) as count
         from submissions where ${SCOPE} group by 1
       ) c on c.day = d.day::date
       order by d.day`,
      [scope]
    ),
  ]);

  const t = totals.rows[0];
  return {
    total: t.total,
    byStatus: {
      Pending: t.pending,
      'Under Review': t.under_review,
      Approved: t.approved,
      Rejected: t.rejected,
      Completed: t.completed,
    },
    unassigned: t.unassigned,
    activity: activity.rows,
  };
}

export async function getDepartmentStats(user) {
  const { rows } = await query(
    `select coalesce(department, 'Unspecified') as department, count(*)::int as count
     from submissions where ${SCOPE}
     group by 1 order by count desc, department limit 12`,
    [hospitalScope(user)]
  );
  return rows;
}

export async function getRecentSubmissions(user, limit = 6) {
  const { items } = await listSubmissions({
    hospitalIds: hospitalScope(user),
    includePatientName: can(user, 'viewPatientName'),
    sortBy: 'submittedAt',
    order: 'desc',
    page: 1,
    limit,
  });
  return items;
}
