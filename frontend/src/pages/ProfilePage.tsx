import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../components/design/ActionButton';
import { CONTROL_INPUT_CLASS_NAME, FieldControl } from '../components/design/FieldControl';
import { StatusBanner } from '../components/design/StatusBanner';
import { SurfacePanel } from '../components/design/SurfacePanel';
import { AppShell } from '../components/layout/AppShell';
import { PremiumPageHeader } from '../components/layout/PremiumPageHeader';
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
        <PremiumPageHeader
          title="Profile Settings"
          description="Update your account profile and preferences."
        />

        {errorMessage ? (
          <StatusBanner tone="danger">
            {errorMessage}
          </StatusBanner>
        ) : null}

        <SurfacePanel as="section" variant="solid" padding="md">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[color:var(--text-main)]">Profile</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Keep your display name and default currency up to date.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="grid gap-4 md:grid-cols-2">
            <FieldControl label="Name" htmlFor="profile-name">
              <input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                className={CONTROL_INPUT_CLASS_NAME}
              />
            </FieldControl>

            <FieldControl label="Default Currency" htmlFor="profile-currency">
              <select
                id="profile-currency"
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
                required
                className={CONTROL_INPUT_CLASS_NAME}
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </FieldControl>

            <div className="md:col-span-2">
              <ActionButton type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </ActionButton>
            </div>
          </form>
        </SurfacePanel>

        <SurfacePanel as="section" variant="solid" padding="md" className="border-rose-300/70 dark:border-rose-900/40">
          <h2 className="text-base font-semibold text-rose-700 dark:text-rose-300">Danger Zone</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Deleting your account is irreversible and removes all your data.
          </p>
          <ActionButton
            type="button"
            variant="danger"
            onClick={() => setIsDeleteModalOpen(true)}
            className="mt-4"
          >
            Delete Account
          </ActionButton>
        </SurfacePanel>
      </AppShell>

      {successMessage ? (
        <StatusBanner tone="success" className="fixed right-4 top-4 z-[60] max-w-md shadow-lg">
          {successMessage}
        </StatusBanner>
      ) : null}

      {isDeleteModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <SurfacePanel as="div" variant="solid" padding="md" className="w-full max-w-md shadow-xl">
            <h2 id="delete-account-title" className="ds-display text-lg font-semibold text-[color:var(--text-main)]">
              Delete Account
            </h2>
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300">
              Are you sure? This action is irreversible.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <ActionButton
                type="button"
                variant="neutral"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeletingAccount}
              >
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                onClick={() => {
                  void handleDeleteAccount();
                }}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </ActionButton>
            </div>
          </SurfacePanel>
        </div>
      ) : null}
    </>
  );
}
