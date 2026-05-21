import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import LoginPage from '@/pages/LoginPage';
import MainLayout from '@/components/MainLayout';
import SetupPage from '@/pages/SetupPage';

type View = 'login' | 'setup';

export default function AppShell() {
  const { user, profile, loading } = useAuth();
  const [view, setView] = useState<View>('login');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // If user is authenticated and has a profile in Firestore, show the main app
  if (user && profile) {
    return <MainLayout />;
  }

  // If user is authenticated but no profile in Firestore, show setup
  // This handles the case where Auth user was created but Firestore write failed
  // The setup page will detect the existing auth user and handle it
  if (user && !profile) {
    return (
      <SetupPage
        onBack={() => setView('login')}
        onComplete={() => setView('login')}
      />
    );
  }

  // Not authenticated - show login or setup
  if (view === 'setup') {
    return (
      <SetupPage
        onBack={() => setView('login')}
        onComplete={() => setView('login')}
      />
    );
  }

  return <LoginPage onSetup={() => setView('setup')} />;
}
