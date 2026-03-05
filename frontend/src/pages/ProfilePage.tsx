import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { SUPPORTED_CURRENCIES } from '../constants/currencies';
import { useAuth } from '../context/AuthContext';
import { ApiClientError, deleteCurrentUser, updateCurrentUser } from '../services/api';

export function ProfilePage(): JSX.Element {
  const { token, user, logout, setAuthenticatedUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState<string>(user?.name ?? '');
  const [defaultCurrency, setDefaultCurrency] = useState<string>(user?.defaultCurrency ?? 'EUR');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name);
    setDefaultCurrency(user.defaultCurrency || 'EUR');
  }, [user]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token || !user) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setErrorMessage('Name must be at least 2 characters.');
      return;
    }

    setIsSaving(true);

    try {
      const updatedUser = await updateCurrentUser(token, {
        name: trimmedName,
        defaultCurrency,
      });

      setAuthenticatedUser(updatedUser);
      setSuccessMessage('Profile updated successfully.');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to update your profile.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }

    setErrorMessage(null);
    setIsDeletingAccount(true);

    try {
      await deleteCurrentUser(token);
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to delete your account.');
      }
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteModalOpen(false);
    }
  }

  return (
    <>
      <AppShell activeItem="profile">
        <header className="rounded-xl bg-slate-50 px-6 py-6 dark:bg-slate-950/50">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Profile Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Update your account profile and preferences.
          </p>
        </header>

        {errorMessage ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Keep your display name and default currency up to date.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Default Currency
              </span>
              <select
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500"
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/40 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-rose-700 dark:text-rose-300">Danger Zone</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Deleting your account is irreversible and removes all your data.
          </p>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Delete Account
          </button>
        </section>
      </AppShell>

      {successMessage ? (
        <div className="fixed right-4 top-4 z-[60] rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950/80 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      {isDeleteModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="delete-account-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Delete Account
            </h2>
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300">
              Are you sure? This action is irreversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingAccount}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAccount();
                }}
                disabled={isDeletingAccount}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
