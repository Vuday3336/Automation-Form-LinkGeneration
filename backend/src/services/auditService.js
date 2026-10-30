import { insertAuditLog } from '../models/AuditLog.js';
import { logger } from '../utils/logger.js';

// Best-effort audit entry for events outside a transaction (logins, views, denials).
// A failure to write the audit log is logged but must not turn a valid request into an error.
// Changes that MUST be audited together with the data (status changes, new submissions)
// call insertAuditLog inside their own transaction instead, so both succeed or neither does.
export async function recordAudit(entry) {
  try {
    await insertAuditLog(entry);
  } catch (err) {
    logger.error(`Failed to write audit log for action ${entry.action}`, err);
  }
}
