import { Coffee, ShoppingCart, Clock, Receipt, CreditCard, BookOpen, ChartBar as BarChart3, History, LogOut, X, Users, LayoutDashboard, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import type { Page } from '@/components/MainLayout';
import type { Shift } from '@/lib/types';

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  isAdmin: boolean;
  activeShift: Shift | null;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

const kasirItems: { page: Page; label: string; icon: any }[] = [
  { page: 'shift', label: 'Shift', icon: Clock },
  { page: 'pos', label: 'Kasir', icon: ShoppingCart },
  { page: 'open_bill', label: 'Open Bill', icon: Receipt },
  { page: 'riwayat', label: 'Riwayat', icon: History },
  { page: 'kasbon', label: 'Kasbon', icon: CreditCard },
];

const adminItems: { page: Page; label: string; icon: any }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'menu', label: 'Produk', icon: BookOpen },
  { page: 'bahan_baku', label: 'Bahan Baku', icon: Package },
  { page: 'laporan', label: 'Laporan', icon: BarChart3 },
  { page: 'kasbon', label: 'Kasbon', icon: CreditCard },
  { page: 'users', label: 'Pengguna', icon: Users },
];

export default function Sidebar({ page, onNavigate, isAdmin, activeShift, onLogout, open, onClose }: Props) {
  const { profile } = useAuth();
  const items = isAdmin ? adminItems : kasirItems;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary text-primary-foreground flex flex-col transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Coffee className="h-6 w-6" />
            <span className="font-display text-lg font-bold">Kopi Or New</span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden text-primary-foreground hover:bg-white/10" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 py-2 text-xs opacity-70">
          <div>{profile?.displayName}</div>
          <div className="capitalize">{profile?.role}</div>
        </div>

        {!isAdmin && (
          <div className="px-4 py-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${activeShift ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-green-400' : 'bg-red-400'}`} />
              {activeShift ? 'Shift Aktif' : 'Belum Buka Shift'}
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                page === item.page
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </div>
      </aside>
    </>
  );
}
