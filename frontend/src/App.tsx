import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage, RegisterPage } from './pages/AuthPage';
import { AccountsCardsPage } from './pages/AccountsCardsPage';
import { AdminPage } from './pages/AdminPage';
import { BudgetPage } from './pages/BudgetPage';
import { CategoryEditorPage } from './pages/CategoryEditorPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { MailboxPage } from './pages/MailboxPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecurringRulesPage } from './pages/RecurringRulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsCardsPage />} />
        <Route path="/budgets" element={<BudgetPage />} />
        <Route path="/recurring-rules" element={<RecurringRulesPage />} />
        <Route path="/mailbox" element={<MailboxPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/categories" element={<CategoryEditorPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<Navigate to="/categories" replace />} />
      </Route>

      <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
