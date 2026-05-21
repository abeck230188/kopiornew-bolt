import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  hasProfile: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (data.isActive === false) {
              // User is deactivated - sign them out
              await signOut(auth);
              setProfile(null);
            } else {
              setProfile(data);
            }
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.isActive === false) {
          await signOut(auth);
          setProfile(null);
          throw new Error('Akun Anda telah dinonaktifkan. Hubungi admin.');
        }
        setProfile(data);
      } else {
        await signOut(auth);
        setProfile(null);
        throw new Error('Profil pengguna tidak ditemukan di database. Mungkin setup sebelumnya gagal. Gunakan "Reset / Ulangi Setup" untuk membuat ulang.');
      }
    } catch (err: any) {
      if (err.message?.includes('dinonaktifkan') || err.message?.includes('tidak ditemukan')) {
        throw err;
      }
      await signOut(auth);
      setProfile(null);
      throw new Error('Gagal membaca profil. Pastikan Firestore Security Rules mengizinkan akses untuk authenticated users.');
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        logout,
        isAdmin: profile?.role === 'admin',
        hasProfile: !!profile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
