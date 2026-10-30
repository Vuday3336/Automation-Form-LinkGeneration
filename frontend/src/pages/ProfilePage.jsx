import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, getErrorMessage } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { can } from '../lib/permissions.js';
import { formatDate } from '../lib/format.js';
import { Card, DetailList, PageHeader } from '../components/ui/Card.jsx';
import { Badge, RoleBadge } from '../components/ui/Badge.jsx';
import { ErrorBanner } from '../components/ui/Feedback.jsx';
import { Input } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(12, 'At least 12 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

export default function ProfilePage() {
  const { user } = useAuth();
  const hospitals = useApi('/hospitals');
  const [serverError, setServerError] = useState('');
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setServerError('');
    setSaved(false);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      reset();
      setSaved(true);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <>
      <PageHeader title="Profile & settings" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Your account">
          <DetailList
            items={[
              { label: 'Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Role', value: <RoleBadge role={user.role} /> },
              { label: 'Member since', value: formatDate(user.createdAt) },
              {
                label: 'Hospital access',
                value:
                  user.role === 'super_admin' ? (
                    'All hospitals'
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(hospitals.data?.items ?? []).map((h) => <Badge key={h.id}>{h.name}</Badge>)}
                    </div>
                  ),
              },
              { label: 'Patient names', value: can(user, 'viewPatientName') ? 'Visible to you' : 'Hidden for your role' },
            ]}
          />
        </Card>

        <Card title="Change password" description="Use at least 12 characters. A passphrase of a few random words works well.">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <ErrorBanner message={serverError} />
            {saved && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Password changed.
              </p>
            )}
            <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
            <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            <Button type="submit" loading={isSubmitting}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
