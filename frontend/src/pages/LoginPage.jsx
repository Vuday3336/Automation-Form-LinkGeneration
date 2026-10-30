import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Form.jsx';
import { ErrorBanner, FullPageSpinner } from '../components/ui/Feedback.jsx';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

// Only allow redirects to pages inside this app (blocks "open redirect" tricks like ?next=//evil.com).
const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export default function LoginPage() {
  const { user, checking, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const next = safeNext(params.get('next'));
  const fromSecureLink = next.startsWith('/submissions/secure/');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  if (checking) return <FullPageSpinner />;
  if (user) return <Navigate to={next} replace />;

  const onSubmit = async ({ email, password }) => {
    setServerError('');
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-600 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">HospitalForm AI</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Google Form submissions, delivered securely to the right hospital team.</h2>
          <ul className="mt-8 space-y-3 text-sm text-brand-50">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Role-based, hospital-level access control</li>
            <li className="flex items-center gap-2"><Lock className="h-4 w-4" /> Encrypted patient fields and expiring links</li>
          </ul>
        </div>
        <p className="text-xs text-brand-100">Development environment · dummy data only</p>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">HospitalForm AI</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fromSecureLink ? 'Sign in to open the secure submission link.' : 'Use the account an administrator created for you.'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <ErrorBanner message={serverError} />
            <Input label="Email" type="email" autoComplete="username" error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
            <Button type="submit" loading={isSubmitting} className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
