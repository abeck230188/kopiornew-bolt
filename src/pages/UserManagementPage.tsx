import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auth, secondaryAuth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import {
  getAllUsers,
  createUserProfile,
  updateUserProfile,
} from '@/lib/firestore';
import { formatDateTime } from '@/lib/format';
import type { UserProfile, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, Plus, Pencil, KeyRound, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagementPage() {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<UserRole>('kasir');
  const [addProcessing, setAddProcessing] = useState(false);

  // Edit user dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('kasir');
  const [editProcessing, setEditProcessing] = useState(false);

  // Reset password dialog
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [resetProcessing, setResetProcessing] = useState(false);

  // Toggle active dialog
  const [showToggleDialog, setShowToggleDialog] = useState(false);
  const [toggleUser, setToggleUser] = useState<UserProfile | null>(null);
  const [toggleProcessing, setToggleProcessing] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async () => {
    if (!addName.trim() || !addEmail.trim() || !addPassword) {
      toast.error('Lengkapi semua field');
      return;
    }
    if (addPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    setAddProcessing(true);
    try {
      // Use secondary auth instance so creating a user doesn't sign out the admin
      const cred = await createUserWithEmailAndPassword(secondaryAuth, addEmail.trim(), addPassword);

      // Save profile to Firestore
      await createUserProfile(cred.user.uid, {
        email: addEmail.trim(),
        displayName: addName.trim(),
        role: addRole,
        isActive: true,
        createdAt: Date.now(),
      });

      // Sign out the new user from the secondary instance
      await signOut(secondaryAuth);

      toast.success(`Pengguna ${addName.trim()} berhasil ditambahkan`);
      setShowAddDialog(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      setAddRole('kasir');
      loadUsers();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Email sudah terdaftar');
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password terlalu lemah. Minimal 6 karakter.');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Format email tidak valid');
      } else {
        toast.error(err.message || 'Gagal menambahkan pengguna');
      }
    } finally {
      setAddProcessing(false);
    }
  };

  const handleEditUser = async () => {
    if (!editUser || !editName.trim()) {
      toast.error('Masukkan nama pengguna');
      return;
    }
    setEditProcessing(true);
    try {
      await updateUserProfile(editUser.uid, {
        displayName: editName.trim(),
        role: editRole,
      });
      toast.success('Data pengguna diperbarui');
      setShowEditDialog(false);
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error('Gagal memperbarui pengguna');
    } finally {
      setEditProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResetProcessing(true);
    try {
      await sendPasswordResetEmail(auth, resetUser.email);
      toast.success(`Email reset password dikirim ke ${resetUser.email}`);
      setShowResetDialog(false);
      setResetUser(null);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        toast.error('User tidak ditemukan di Firebase Auth');
      } else {
        toast.error(err.message || 'Gagal mengirim email reset');
      }
    } finally {
      setResetProcessing(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleUser) return;
    // Prevent deactivating yourself
    if (toggleUser.uid === adminProfile?.uid && toggleUser.isActive) {
      toast.error('Tidak dapat menonaktifkan akun Anda sendiri');
      setShowToggleDialog(false);
      return;
    }
    setToggleProcessing(true);
    try {
      const newActive = !toggleUser.isActive;
      await updateUserProfile(toggleUser.uid, { isActive: newActive });
      toast.success(newActive ? 'Pengguna diaktifkan kembali' : 'Pengguna dinonaktifkan');
      setShowToggleDialog(false);
      setToggleUser(null);
      loadUsers();
    } catch (err: any) {
      toast.error('Gagal mengubah status pengguna');
    } finally {
      setToggleProcessing(false);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setEditUser(user);
    setEditName(user.displayName);
    setEditRole(user.role);
    setShowEditDialog(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Kelola Pengguna</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Pengguna
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="border-amber-200">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Belum ada pengguna</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.uid} className={`border-amber-200 ${u.isActive === false ? 'opacity-60' : ''}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    u.role === 'admin' ? 'bg-primary' : 'bg-amber-500'
                  }`}>
                    {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{u.displayName}</p>
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                        {u.role === 'admin' ? 'Admin' : 'Kasir'}
                      </Badge>
                      {u.isActive === false && (
                        <Badge variant="destructive" className="text-xs">Nonaktif</Badge>
                      )}
                      {u.uid === adminProfile?.uid && (
                        <Badge variant="outline" className="text-xs text-amber-600">Anda</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">Dibuat: {formatDateTime(u.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(u)}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setResetUser(u); setShowResetDialog(true); }}
                      title="Reset Password"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${u.isActive === false ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'}`}
                      onClick={() => { setToggleUser(u); setShowToggleDialog(true); }}
                      title={u.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
                    >
                      {u.isActive === false ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna</DialogTitle>
            <DialogDescription>Buat akun baru untuk kasir atau admin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input
                placeholder="Nama lengkap"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@contoh.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Min. 6 karakter"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="kasir">Kasir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batalkan</Button>
            <Button onClick={handleAddUser} disabled={addProcessing}>
              {addProcessing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
            <DialogDescription>Ubah nama dan role pengguna</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="kasir">Kasir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Batalkan</Button>
            <Button onClick={handleEditUser} disabled={editProcessing}>
              {editProcessing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Kirim email reset password ke <strong>{resetUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Pengguna akan menerima email dari Firebase dengan tautan untuk mengatur ulang password mereka.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Batalkan</Button>
            <Button onClick={handleResetPassword} disabled={resetProcessing}>
              {resetProcessing ? 'Mengirim...' : 'Kirim Email Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active Dialog */}
      <Dialog open={showToggleDialog} onOpenChange={setShowToggleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {toggleUser?.isActive === false ? 'Aktifkan Pengguna' : 'Nonaktifkan Pengguna'}
            </DialogTitle>
            <DialogDescription>
              {toggleUser?.isActive === false
                ? `Aktifkan kembali akun ${toggleUser?.displayName}? Pengguna akan bisa login kembali.`
                : `Nonaktifkan akun ${toggleUser?.displayName}? Pengguna tidak akan bisa login hingga diaktifkan kembali.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToggleDialog(false)}>Batalkan</Button>
            <Button
              variant={toggleUser?.isActive === false ? 'default' : 'destructive'}
              onClick={handleToggleActive}
              disabled={toggleProcessing}
            >
              {toggleProcessing ? 'Memproses...' : toggleUser?.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
