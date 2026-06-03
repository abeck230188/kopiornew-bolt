import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getActiveShift } from '@/lib/firestore';
import type { Shift } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import POSPage from '@/pages/POSPage';
import ShiftPage from '@/pages/ShiftPage';
import OpenBillPage from '@/pages/OpenBillPage';
import KasbonPage from '@/pages/KasbonPage';
import MenuPage from '@/pages/MenuPage';
import ReportsPage from '@/pages/ReportsPage';
import RiwayatPage from '@/pages/RiwayatPage';
import UserManagementPage from '@/pages/UserManagementPage';
import DashboardPage from '@/pages/DashboardPage';
import BahanBakuPage from '@/pages/BahanBakuPage';

export type Page = 'dashboard' | 'pos' | 'shift' | 'open_bill' | 'kasbon' | 'menu' | 'laporan' | 'riwayat' | 'users' | 'bahan_baku';

const ADMIN_PAGES: Page[] = ['dashboard', 'menu', 'laporan', 'kasbon', 'users', 'bahan_baku'];
const KASIR_PAGES: Page[] = ['shift', 'pos', 'open_bill', 'riwayat', 'kasbon'];

export default function MainLayout() {
  const { profile, logout } = useAuth();
  const [page, setPage] = useState<Page>('pos');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (profile) {
      getActiveShift(profile.uid).then(setActiveShift);
    }
  }, [profile]);

  // Enforce role-based default page on mount and role change
  useEffect(() => {
    if (!profile) return;
    const allowedPages = isAdmin ? ADMIN_PAGES : KASIR_PAGES;
    if (!allowedPages.includes(page)) {
      setPage(isAdmin ? 'dashboard' : 'pos');
    }
  }, [profile, isAdmin]);

  const refreshShift = async () => {
    if (profile) {
      const s = await getActiveShift(profile.uid);
      setActiveShift(s);
    }
  };

  const navigate = (p: Page) => {
    const allowedPages = isAdmin ? ADMIN_PAGES : KASIR_PAGES;
    if (!allowedPages.includes(p)) return;
    setPage(p);
    setSidebarOpen(false);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return isAdmin ? <DashboardPage /> : null;
      case 'pos':
        return !isAdmin ? <POSPage activeShift={activeShift} onNavigate={navigate} /> : null;
      case 'shift':
        return !isAdmin ? <ShiftPage activeShift={activeShift} onShiftChange={refreshShift} onNavigate={navigate} /> : null;
      case 'open_bill':
        return !isAdmin ? <OpenBillPage activeShift={activeShift} onNavigate={navigate} /> : null;
      case 'kasbon':
        return <KasbonPage activeShift={activeShift} />;
      case 'menu':
        return isAdmin ? <MenuPage /> : null;
      case 'laporan':
        return isAdmin ? <ReportsPage /> : null;
      case 'users':
        return isAdmin ? <UserManagementPage /> : null;
      case 'bahan_baku':
        return isAdmin ? <BahanBakuPage /> : null;
      case 'riwayat':
        return !isAdmin ? <RiwayatPage activeShift={activeShift} /> : null;
      default:
        return isAdmin ? <DashboardPage /> : <POSPage activeShift={activeShift} onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex">
      <Sidebar
        page={page}
        onNavigate={navigate}
        isAdmin={isAdmin}
        activeShift={activeShift}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-3 md:p-4 lg:p-6 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
