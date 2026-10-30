import * as dashboardService from '../services/dashboardService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function stats(req, res) {
  sendSuccess(res, { data: await dashboardService.getStats(req.user) });
}

export async function recentSubmissions(req, res) {
  sendSuccess(res, { data: { items: await dashboardService.getRecentSubmissions(req.user) } });
}

export async function departmentStats(req, res) {
  sendSuccess(res, { data: { items: await dashboardService.getDepartmentStats(req.user) } });
}
