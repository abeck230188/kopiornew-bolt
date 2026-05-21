import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Coffee, LogIn, Settings, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onSetup: () => void;
}

export default function LoginPage({ onSetup }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Masukkan email dan password');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Berhasil masuk!');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Email atau password salah');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Terlalu banyak percobaan. Coba lagi nanti.');
      } else if (code === 'auth/invalid-email') {
        toast.error('Format email tidak valid');
      } else {
        toast.error(err.message || 'Gagal masuk. Periksa email dan password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-amber-200/50">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Coffee className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display text-primary">Kopi Or New</CardTitle>
          <CardDescription className="text-muted-foreground">Sistem Kasir Kopi Shop</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-amber-200 focus-visible:ring-primary"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-amber-200 focus-visible:ring-primary"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onSetup}>
              <Settings className="mr-1 h-3 w-3" /> Setup Admin Pertama
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive/60 hover:text-destructive"
              onClick={onSetup}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Reset / Ulangi Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
