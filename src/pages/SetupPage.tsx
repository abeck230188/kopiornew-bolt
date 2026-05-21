import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, ArrowLeft, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle } from 'lucide-react';
import FirestoreRulesHelper from '@/components/FirestoreRulesHelper';
import { toast } from 'sonner';

interface Props {
  onBack: () => void;
  onComplete: () => void;
}

export default function SetupPage({ onBack, onComplete }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [repairMode, setRepairMode] = useState(false);

  // Check if there's already an auth user without a Firestore profile
  // This happens when setup previously failed
  useEffect(() => {
    if (auth.currentUser && auth.currentUser.email) {
      setEmail(auth.currentUser.email);
      setRepairMode(true);
    }
  }, []);

  const saveProfileToFirestore = async (uid: string, emailVal: string, nameVal: string) => {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: emailVal,
      displayName: nameVal,
      role: 'admin',
      isActive: true,
      createdAt: Date.now(),
    });
  };

  const createDefaultCategories = async () => {
    try {
      const categories = [
        { name: 'Kopi', order: 0, createdAt: Date.now() },
        { name: 'Non-Kopi', order: 1, createdAt: Date.now() },
        { name: 'Makanan', order: 2, createdAt: Date.now() },
        { name: 'Snack', order: 3, createdAt: Date.now() },
      ];
      for (const cat of categories) {
        await addDoc(collection(db, 'categories'), cat);
      }
    } catch (catErr: any) {
      console.error('Category creation failed:', catErr);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('Lengkapi semua field');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    try {
      let uid: string;

      // If there's already a signed-in user without a profile (broken setup),
      // use that user instead of creating a new one
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
      } else {
        // Try to create the user in Firebase Auth
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          uid = cred.user.uid;
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            // User exists in Auth but likely no Firestore profile
            // Try to sign in with the provided credentials
            toast.info('Email sudah terdaftar. Mencoba login dengan kredensial yang diberikan...');
            try {
              const signInCred = await signInWithEmailAndPassword(auth, email, password);
              uid = signInCred.user.uid;
            } catch (signInErr: any) {
              toast.error('Email sudah terdaftar tapi password salah. Jika setup sebelumnya gagal, hapus user dari Firebase Console atau gunakan email lain.');
              setLoading(false);
              return;
            }
          } else {
            throw authErr;
          }
        }
      }

      // Save user profile to Firestore
      try {
        await saveProfileToFirestore(uid, email, name);
      } catch (firestoreErr: any) {
        console.error('Firestore write failed:', firestoreErr);
        await signOut(auth);
        toast.error('Gagal menyimpan profil ke Firestore. Pastikan Firestore Rules sudah diterapkan dengan benar, lalu coba lagi.');
        setLoading(false);
        return;
      }

      // Create default categories
      await createDefaultCategories();

      // Verify the profile was saved correctly
      const profileSnap = await getDoc(doc(db, 'users', uid));
      if (profileSnap.exists()) {
        await signOut(auth);
        setSuccess(true);
        toast.success('Admin berhasil dibuat!');
      } else {
        await signOut(auth);
        toast.error('Profil tidak ditemukan setelah disimpan. Coba lagi.');
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/weak-password') {
        toast.error('Password terlalu lemah. Minimal 6 karakter.');
      } else if (code === 'auth/invalid-email') {
        toast.error('Format email tidak valid.');
      } else {
        toast.error(err.message || 'Gagal membuat admin');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-amber-200/50">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-primary">Admin Berhasil Dibuat</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Akun admin telah dibuat di Firebase Auth dan Firestore. Silakan login dengan email dan password yang baru dibuat.
              </p>
            </div>
            <Button onClick={onComplete} className="w-full">
              Ke Halaman Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-xl border-amber-200/50">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Settings className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-display text-primary">
              {repairMode ? 'Perbaiki Setup Admin' : 'Setup Awal'}
            </CardTitle>
            <CardDescription>
              {repairMode
                ? 'User ditemukan di Auth tapi profil tidak ada di Firestore. Lengkapi data untuk memperbaiki.'
                : 'Buat akun admin pertama untuk memulai'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {repairMode && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Setup sebelumnya tidak lengkap. User ada di Firebase Auth tapi profil tidak tersimpan di Firestore. Masukkan nama dan password untuk menyelesaikan setup.
                </p>
              </div>
            )}
            <FirestoreRulesHelper />
            <form onSubmit={handleSetup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input placeholder="Nama admin" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="admin@kopiornew.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={repairMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" placeholder="Min. 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Memproses...' : repairMode ? 'Perbaiki & Simpan' : 'Buat Admin'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onBack}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Kembali ke Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
