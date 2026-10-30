import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { formatDateTime } from '../lib/format.js';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import Button from '../components/ui/Button.jsx';
import CopyButton from '../components/ui/CopyButton.jsx';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm text-slate-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

export default function IntegrationPage() {
  const { data, loading, error, reload } = useApi('/integrations/google-form/info');
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    setSending(true);
    setTestError('');
    try {
      const res = await api.post('/integrations/google-form/test');
      setTestResult(res.data.data);
      reload();
    } catch (err) {
      setTestError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) return <LoadingState />;

  return (
    <>
      <PageHeader title="Integration settings" description="How Google Forms delivers submissions to this system." />
      <ErrorBanner message={error} onRetry={reload} />

      {data && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Google Apps Script configuration" description="Enter these in Apps Script → Project Settings → Script Properties.">
              <dl className="divide-y divide-slate-100">
                <Row label="BACKEND_URL">
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs">{data.endpoint}</code>
                    <CopyButton value={data.endpoint} />
                  </div>
                  {!data.publicApiUrlConfigured && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      This is a local address Google can't reach. Use a public HTTPS URL (tunnel or deployment) and set PUBLIC_API_URL in backend/.env.
                    </p>
                  )}
                </Row>
                <Row label="INTEGRATION_SECRET">
                  {data.secretConfigured ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Configured on the server</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-red-700"><XCircle className="h-4 w-4" /> Not configured</span>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Copy the value from backend/.env yourself. For security it is never shown here. Sent in the <code>{data.secretHeader}</code> header.
                  </p>
                </Row>
                <Row label="Secure links">
                  {data.linkBaseUrl}/submissions/secure/… · valid for {data.linkTtlHours} hours
                </Row>
              </dl>
            </Card>

            <Card title="Recent deliveries" bodyClassName="">
              {data.recentDeliveries.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.recentDeliveries.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                      <Link to={`/submissions/${log.submissionId}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                        {log.submissionId}
                      </Link>
                      <span className="flex items-center gap-2">
                        {!log.metadata.hospitalMatched && <Badge tone="amber">Unassigned</Badge>}
                        <span className="text-slate-500">{formatDateTime(log.timestamp)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500">No submissions received yet.</p>
              )}
            </Card>

            {data.recentRejections.length > 0 && (
              <Card title="Rejected requests" description="Requests with a missing or wrong integration secret." bodyClassName="">
                <ul className="divide-y divide-slate-100">
                  {data.recentRejections.map((log) => (
                    <li key={log.id} className="flex justify-between px-5 py-3 text-sm">
                      <span className="text-red-700">{log.metadata.reason}</span>
                      <span className="text-slate-500">{formatDateTime(log.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card title="Test the pipeline" description="Creates a dummy submission through the exact same code path as a real Google Form.">
              <Button icon={Send} loading={sending} onClick={sendTest} className="w-full">
                Send test submission
              </Button>
              <ErrorBanner message={testError} />
              {testResult && (
                <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-medium text-emerald-800">Created {testResult.submissionId}</p>
                  <p className="text-xs text-emerald-800">Secure link (shown once):</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{testResult.secureUrl}</code>
                    <CopyButton value={testResult.secureUrl} />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Link to={`/submissions/${testResult.submissionId}`} className="text-xs font-medium text-brand-700 hover:underline">Open in dashboard</Link>
                    <a href={testResult.secureUrl} className="text-xs font-medium text-brand-700 hover:underline">Open secure link</a>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Setup checklist">
              <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-600">
                <li>Create a Google Form with a <strong>Hospital Name</strong> question.</li>
                <li>Responses → Link to Sheets.</li>
                <li>In the Sheet: Extensions → Apps Script, paste <code>google-apps-script/Code.gs</code>.</li>
                <li>Add the two Script Properties shown on the left.</li>
                <li>Run <code>setupTrigger</code> and grant permissions.</li>
                <li>Run <code>testWithSamplePayload</code>, then submit the form.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">Full guide: google-apps-script/README.md</p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
