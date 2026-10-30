import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getErrorMessage } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ROLE_LABELS, formatDate } from '../lib/format.js';
import { Card, PageHeader } from '../components/ui/Card.jsx';
import { Badge, RoleBadge } from '../components/ui/Badge.jsx';
import { EmptyState, ErrorBanner, LoadingState } from '../components/ui/Feedback.jsx';
import { Checkbox, Field, Input, Select } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import { Table, Td, Th } from '../components/ui/Table.jsx';

const ALL_ROLES = ['super_admin', 'hospital_admin', 'staff', 'viewer'];

export default function UsersPage() {
  const { user: me } = useAuth();
  const users = useApi('/users');
  const hospitals = useApi('/hospitals');
  const [editing, setEditing] = useState(null); // null | 'new' | user

  const hospitalName = Object.fromEntries((hospitals.data?.items ?? []).map((h) => [h.id, h.code]));
  const assignableRoles = me.role === 'super_admin' ? ALL_ROLES : ['staff', 'viewer'];
  const canEdit = (u) => me.role === 'super_admin' || ['staff', 'viewer'].includes(u.role);

  return (
    <>
      <PageHeader
        title="Users"
        description={me.role === 'super_admin' ? 'Everyone with access to HospitalForm AI.' : 'People with access to your hospitals.'}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Add user</Button>}
      />
      <ErrorBanner message={users.error} onRetry={users.reload} />

      <Card bodyClassName="" className="mt-4">
        {users.loading && !users.data ? (
          <LoadingState />
        ) : users.data?.items.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Hospitals</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium text-slate-900">{u.name}{u.id === me.id && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </Td>
                  <Td><RoleBadge role={u.role} /></Td>
                  <Td>
                    {u.role === 'super_admin' ? (
                      <span className="text-slate-500">All hospitals</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.hospitalAccess.map((id) => <Badge key={id}>{hospitalName[id] ?? 'Other'}</Badge>)}
                      </div>
                    )}
                  </Td>
                  <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
                  <Td>{formatDate(u.createdAt)}</Td>
                  <Td className="text-right">
                    {canEdit(u) && <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(u)}>Edit</Button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No users" />
        )}
      </Card>

      <UserModal
        target={editing}
        me={me}
        roles={assignableRoles}
        hospitals={(hospitals.data?.items ?? []).filter((h) => h.isActive)}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); users.reload(); }}
      />
    </>
  );
}

function buildSchema(isNew) {
  return z
    .object({
      name: z.string().trim().min(2, 'At least 2 characters').max(120),
      email: z.email('Enter a valid email'),
      password: isNew ? z.string().min(12, 'At least 12 characters') : z.string().optional(),
      role: z.enum(ALL_ROLES),
      isActive: z.boolean(),
      hospitalAccess: z.array(z.string()),
    })
    .refine((v) => v.role === 'super_admin' || v.hospitalAccess.length > 0, {
      path: ['hospitalAccess'],
      message: 'Select at least one hospital',
    });
}

function UserModal({ target, me, roles, hospitals, onClose, onSaved }) {
  const isNew = target === 'new';
  const isSelf = !isNew && target?.id === me.id;
  const [serverError, setServerError] = useState('');
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(buildSchema(isNew)),
    values:
      isNew || !target
        ? { name: '', email: '', password: '', role: roles.at(-2) ?? 'staff', isActive: true, hospitalAccess: [] }
        : { name: target.name, email: target.email, password: '', role: target.role, isActive: target.isActive, hospitalAccess: target.hospitalAccess },
  });
  const role = watch('role');

  const onSubmit = async ({ name, email, password, role: newRole, isActive, hospitalAccess }) => {
    setServerError('');
    try {
      if (isNew) {
        await api.post('/auth/register', { name, email, password, role: newRole, hospitalAccess });
      } else {
        const changes = { name, hospitalAccess };
        if (!isSelf) Object.assign(changes, { role: newRole, isActive });
        await api.patch(`/users/${target.id}`, changes);
      }
      onSaved();
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={isNew ? 'Add user' : `Edit ${target?.name ?? ''}`}
      description={isNew ? 'Share the password with them through a secure channel; they can change it under Profile.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={isSubmitting}>{isNew ? 'Create user' : 'Save'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <ErrorBanner message={serverError} />
        <Input label="Full name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" disabled={!isNew} error={errors.email?.message} {...register('email')} />
        {isNew && <Input label="Initial password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />}
        <Select label="Role" disabled={isSelf} {...register('role')} hint={isSelf ? "You can't change your own role." : undefined}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>

        {role !== 'super_admin' && (
          <Controller
            control={control}
            name="hospitalAccess"
            render={({ field }) => (
              <Field label="Hospital access" error={errors.hospitalAccess?.message}>
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  {hospitals.map((h) => (
                    <Checkbox
                      key={h.id}
                      label={h.name}
                      checked={field.value.includes(h.id)}
                      onChange={(e) => field.onChange(e.target.checked ? [...field.value, h.id] : field.value.filter((id) => id !== h.id))}
                    />
                  ))}
                </div>
              </Field>
            )}
          />
        )}
        {!isNew && !isSelf && <Checkbox label="Account active" {...register('isActive')} />}
      </form>
    </Modal>
  );
}
