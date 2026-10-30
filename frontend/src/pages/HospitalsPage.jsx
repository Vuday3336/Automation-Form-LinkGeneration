import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getErrorMessage } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { can } from '../lib/permissions.js';
import { formatDate } from '../lib/format.js';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import { Input } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Table, Td, Th } from '../components/ui/Table.jsx';

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, '2–20 letters, numbers or dashes'),
  name: z.string().trim().min(2, 'At least 2 characters').max(200),
});

export default function HospitalsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/hospitals');
  const [editing, setEditing] = useState(null); // null | 'new' | hospital
  const [rowError, setRowError] = useState('');
  const canManage = can(user, 'manageHospitals');

  const toggleActive = async (hospital) => {
    setRowError('');
    try {
      await api.patch(`/hospitals/${hospital.id}`, { isActive: !hospital.isActive });
      reload();
    } catch (err) {
      setRowError(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Hospitals"
        description={canManage ? 'Hospitals that form submissions are matched to.' : 'Hospitals you have access to.'}
        actions={canManage && <Button icon={Plus} onClick={() => setEditing('new')}>Add hospital</Button>}
      />
      <ErrorBanner message={error || rowError} onRetry={error ? reload : undefined} />

      <Card bodyClassName="" className="mt-4">
        {loading && !data ? (
          <LoadingState />
        ) : data?.items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th className="text-right">Submissions</Th>
                <Th className="text-right">Users</Th>
                <Th>Created</Th>
                {canManage && <Th className="text-right"><span className="sr-only">Actions</span></Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs font-semibold text-slate-900">{h.code}</Td>
                  <Td className="font-medium text-slate-900">{h.name}</Td>
                  <Td>{h.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</Td>
                  <Td className="text-right tabular-nums">{h.submissionCount}</Td>
                  <Td className="text-right tabular-nums">{h.userCount}</Td>
                  <Td>{formatDate(h.createdAt)}</Td>
                  {canManage && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(h)}>Rename</Button>
                        <Button variant="secondary" size="sm" onClick={() => toggleActive(h)}>
                          {h.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No hospitals" />
        )}
      </Card>

      <HospitalModal hospital={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    </>
  );
}

function HospitalModal({ hospital, onClose, onSaved }) {
  const isNew = hospital === 'new';
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: isNew || !hospital ? { code: '', name: '' } : { code: hospital.code, name: hospital.name },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      if (isNew) await api.post('/hospitals', values);
      else await api.patch(`/hospitals/${hospital.id}`, { name: values.name });
      onSaved();
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <Modal
      open={Boolean(hospital)}
      onClose={onClose}
      title={isNew ? 'Add hospital' : 'Rename hospital'}
      description={isNew ? 'Form answers are matched to hospitals by exact name (any case) or code.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hospital-form" loading={isSubmitting}>Save</Button>
        </>
      }
    >
      <form id="hospital-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner message={serverError} />
        <Input label="Code" placeholder="e.g. DCGH" disabled={!isNew} error={errors.code?.message} {...register('code')} />
        <Input label="Name" placeholder="e.g. Demo City General Hospital" error={errors.name?.message} {...register('name')} />
      </form>
    </Modal>
  );
}
