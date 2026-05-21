import { useState, useEffect } from 'react';
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { formatRupiah } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, TriangleAlert as AlertTriangle, Coffee, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Category dialog
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showDeleteCatDialog, setShowDeleteCatDialog] = useState(false);
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [catHasProducts, setCatHasProducts] = useState(false);

  // Product dialog
  const [showProdDialog, setShowProdDialog] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodHargaJual, setProdHargaJual] = useState('');
  const [prodHpp, setProdHpp] = useState('');
  const [prodPhotoUrl, setProdPhotoUrl] = useState('');
  const [prodActive, setProdActive] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
    setCategories(cats);
    setProducts(prods);
  };

  useEffect(() => { loadData(); }, []);

  // Category handlers
  const handleSaveCategory = async () => {
    if (!catName.trim()) { toast.error('Masukkan nama kategori'); return; }
    setProcessing(true);
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, { name: catName.trim() });
        toast.success('Kategori diperbarui');
      } else {
        await addCategory({
          name: catName.trim(),
          order: categories.length,
          createdAt: Date.now(),
        });
        toast.success('Kategori ditambahkan');
      }
      setShowCatDialog(false);
      setCatName('');
      setEditingCat(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!catToDelete) return;
    const hasProds = products.some((p) => p.categoryId === catToDelete.id);
    if (hasProds) {
      setCatHasProducts(true);
      return;
    }
    setProcessing(true);
    try {
      await deleteCategory(catToDelete.id);
      toast.success('Kategori dihapus');
      setShowDeleteCatDialog(false);
      setCatToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Product handlers
  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProd(product);
      setProdName(product.name);
      setProdCategoryId(product.categoryId);
      setProdHargaJual(String(product.hargaJual));
      setProdHpp(String(product.hpp));
      setProdPhotoUrl(product.photoUrl);
      setProdActive(product.active);
    } else {
      setEditingProd(null);
      setProdName('');
      setProdCategoryId(categories[0]?.id || '');
      setProdHargaJual('');
      setProdHpp('');
      setProdPhotoUrl('');
      setProdActive(true);
    }
    setPhotoFile(null);
    setShowProdDialog(true);
  };

  const handleSaveProduct = async () => {
    if (!prodName.trim() || !prodCategoryId || !prodHargaJual || !prodHpp) {
      toast.error('Lengkapi semua field');
      return;
    }
    setProcessing(true);
    try {
      let photoUrl = prodPhotoUrl;
      if (photoFile) {
        setUploading(true);
        photoUrl = await uploadToCloudinary(photoFile);
        setUploading(false);
        toast.success('Foto berhasil diupload');
      }

      const catName = categories.find((c) => c.id === prodCategoryId)?.name || '';
      const data = {
        name: prodName.trim(),
        categoryId: prodCategoryId,
        categoryName: catName,
        hargaJual: parseInt(prodHargaJual),
        hpp: parseInt(prodHpp),
        photoUrl,
        active: prodActive,
      };

      if (editingProd) {
        await updateProduct(editingProd.id, data);
        toast.success('Produk diperbarui');
      } else {
        await addProduct({ ...data, createdAt: Date.now() });
        toast.success('Produk ditambahkan');
      }
      setShowProdDialog(false);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setProcessing(true);
    try {
      await deleteProduct(id);
      toast.success('Produk dihapus');
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    await updateProduct(product.id, { active: !product.active });
    loadData();
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold">Kelola Produk</h2>

      <Tabs defaultValue="products">
        <TabsList className="bg-amber-100">
          <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Produk
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Kategori
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openProductDialog()}>
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {products.map((p) => (
              <Card key={p.id} className="border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Coffee className="h-5 w-5 text-amber-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{p.name}</p>
                        <Badge variant="secondary" className="text-xs">{p.categoryName}</Badge>
                        {!p.active && <Badge variant="outline" className="text-xs text-red-500">Nonaktif</Badge>}
                      </div>
                      <p className="text-sm text-primary font-bold">{formatRupiah(p.hargaJual)}</p>
                      <p className="text-xs text-muted-foreground">HPP: {formatRupiah(p.hpp)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.active} onCheckedChange={() => handleToggleActive(p)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProductDialog(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteProduct(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {products.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Belum ada produk</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setEditingCat(null); setCatName(''); setShowCatDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <Card key={cat.id} className="border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{cat.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{products.filter((p) => p.categoryId === cat.id).length} produk</Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCat(cat); setCatName(cat.name); setShowCatDialog(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setCatToDelete(cat); setCatHasProducts(false); setShowDeleteCatDialog(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Kategori</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Contoh: Kopi" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatDialog(false)}>Batalkan</Button>
            <Button onClick={handleSaveCategory} disabled={processing}>{processing ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={showDeleteCatDialog} onOpenChange={setShowDeleteCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              {catHasProducts ? <AlertTriangle className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              Hapus Kategori
            </DialogTitle>
            <DialogDescription>
              {catHasProducts
                ? `Kategori "${catToDelete?.name}" masih memiliki produk. Hapus atau pindahkan produk terlebih dahulu.`
                : `Yakin ingin menghapus kategori "${catToDelete?.name}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteCatDialog(false)}>Batalkan</Button>
            {!catHasProducts && (
              <Button variant="destructive" onClick={handleDeleteCategory} disabled={processing}>Hapus</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={showProdDialog} onOpenChange={setShowProdDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProd ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nama Produk</Label>
              <Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Contoh: Kopi Susu" />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Harga Jual</Label>
                <Input type="number" value={prodHargaJual} onChange={(e) => setProdHargaJual(e.target.value)} placeholder="25000" />
              </div>
              <div className="space-y-2">
                <Label>HPP</Label>
                <Input type="number" value={prodHpp} onChange={(e) => setProdHpp(e.target.value)} placeholder="10000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Foto Produk</Label>
              <div className="relative">
                {uploading && (
                  <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-primary">Uploading...</span>
                  </div>
                )}
                {(prodPhotoUrl || photoFile) ? (
                  <img
                    src={photoFile ? URL.createObjectURL(photoFile) : prodPhotoUrl}
                    alt="Preview"
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Coffee className="h-8 w-8 text-amber-400" />
                  </div>
                )}
              </div>
              <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoFile(f);
              }} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={prodActive} onCheckedChange={setProdActive} />
              <Label>{prodActive ? 'Aktif' : 'Nonaktif'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProdDialog(false)}>Batalkan</Button>
            <Button onClick={handleSaveProduct} disabled={processing || uploading}>
              {uploading ? 'Upload foto...' : processing ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
