import { useState, useEffect } from 'react';
import {
  getProducts,
  getBahanBakuList,
  getResepByProductId,
  saveResepIngredient,
  deleteResepIngredient,
  calculateResepHpp,
  updateProductHpp,
} from '@/lib/firestore';
import { formatRupiah } from '@/lib/format';
import type { Product, BahanBaku } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input as SearchInput } from '@/components/ui/input';
import { Pencil, CircleAlert as AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface IngredientRow {
  resepId?: string;
  bahanId: string;
  bahanName: string;
  qtyPerServing: number;
}

export default function ResepProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bahanList, setBahanList] = useState<BahanBaku[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [bahanSearch, setBahanSearch] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsData, bahanData] = await Promise.all([
        getProducts(),
        getBahanBakuList(),
      ]);
      setProducts(productsData);
      setBahanList(bahanData);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditDialog = async (product: Product) => {
    setEditingProduct(product);
    setBahanSearch('');
    try {
      // Refresh bahan list to get latest prices
      const bahanData = await getBahanBakuList();
      setBahanList(bahanData);

      const resepItems = await getResepByProductId(product.id);
      const ingredientRows = resepItems.map((r) => {
        const bahan = bahanData.find((b) => b.id === r.bahan_baku_id);
        return {
          resepId: r.id,
          bahanId: r.bahan_baku_id,
          bahanName: bahan?.namaBahan || '',
          qtyPerServing: r.qty_per_serving,
        };
      });
      setIngredients(ingredientRows);
      const calculatedHpp = await calculateResepHpp(product.id, bahanData);
      (calculatedHpp);
    } catch (err: any) {
      toast.error('Gagal memuat resep: ' + err.message);
    }
    setShowDialog(true);
  };

  const handleAddIngredient = (bahanId: string) => {
    const bahan = bahanList.find((b) => b.id === bahanId);
    if (!bahan || ingredients.some((i) => i.bahanId === bahanId)) {
      return;
    }
    setIngredients([
      ...ingredients,
      { bahanId, bahanName: bahan.namaBahan, qtyPerServing: 0 },
    ]);
    setBahanSearch('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...ingredients];
    updated[index].qtyPerServing = qty;
    setIngredients(updated);
  };

  const calculateHpp = () => {
    return ingredients.reduce((total, ingredient) => {
      const bahan = bahanList.find((b) => b.id === ingredient.bahanId);
      if (!bahan) return total;
      const hargaSatuan = bahan.hargaSatuan || Math.round(bahan.hargaBeli / bahan.qtyPembelian);
      return total + ingredient.qtyPerServing * hargaSatuan;
    }, 0);
  };

  const handleSaveResep = async () => {
    if (!editingProduct || ingredients.length === 0) {
      toast.error('Tambahkan minimal 1 ingredient');
      return;
    }

    setUpdating(true);
    try {
      for (const ing of ingredients) {
        if (ing.qtyPerServing <= 0) {
          toast.error('Qty harus lebih dari 0');
          setUpdating(false);
          return;
        }
        await saveResepIngredient(editingProduct.id, ing.bahanId, ing.qtyPerServing);
      }

      for (const ing of ingredients) {
        const resepItem = await getResepByProductId(editingProduct.id);
        const inCurrentList = resepItem.some((r) => r.bahan_baku_id === ing.bahanId);
        if (!inCurrentList && ing.resepId) {
          await deleteResepIngredient(ing.resepId);
        }
      }

      toast.success('Resep disimpan');
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateProductHpp = async () => {
    if (!editingProduct) return;
    setUpdating(true);
    try {
      const newHpp = calculateHpp();
      await updateProductHpp(editingProduct.id, newHpp);
      toast.success('HPP produk diperbarui');
      setShowDialog(false);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getFilteredBahan = () => {
    return bahanList.filter(
      (b) =>
        !ingredients.some((i) => i.bahanId === b.id) &&
        b.namaBahan.toLowerCase().includes(bahanSearch.toLowerCase()),
    );
  };

  const currentHpp = calculateHpp();
  const hppDiffers = editingProduct && Math.abs(currentHpp - editingProduct.hpp) > 0;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Resep Produk</h1>
        <p className="text-sm text-muted-foreground">Kelola resep dan HPP produk</p>
      </div>

      {products.length === 0 ? (
        <Card className="border-amber-200">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Belum ada produk</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="border-amber-100 overflow-hidden hover:shadow-lg transition-shadow">
              {product.photoUrl && (
                <div className="h-40 w-full bg-gray-100 overflow-hidden">
                  <img
                    src={product.photoUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">HPP Saat Ini</Label>
                  <p className="font-semibold">{formatRupiah(product.hpp)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">HPP Resep</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-blue-600">{formatRupiah(product.hpp)}</p>
                    {hppDiffers && editingProduct?.id === product.id && (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => openEditDialog(product)}
                  className="w-full mt-3"
                  variant="outline"
                  size="sm"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Resep
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Resep Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Resep: {editingProduct?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Ingredient Search */}
            <div className="space-y-2">
              <Label className="text-xs">Tambah Bahan</Label>
              <div className="flex gap-2">
                <SearchInput
                  placeholder="Cari bahan..."
                  value={bahanSearch}
                  onChange={(e) => setBahanSearch(e.target.value)}
                  className="text-xs h-8"
                />
                <Select onValueChange={handleAddIngredient} value="">
                  <SelectTrigger className="w-fit h-8 text-xs">
                    <SelectValue placeholder="+" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredBahan().map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.namaBahan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
              {ingredients.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada ingredient</p>
              ) : (
                ingredients.map((ing, idx) => {
                  const bahan = bahanList.find((b) => b.id === ing.bahanId);
                  const hargaPerUnit = bahan && bahan.qtyPembelian > 0 ? bahan.hargaBeli / bahan.qtyPembelian : 0;
                  return (
                    <div
                      key={idx}
                      className="flex gap-2 items-end pb-2 border-b last:border-0 text-xs"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{ing.bahanName}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={ing.qtyPerServing || ''}
                          onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="text-right space-y-1">
                        <Label className="text-xs text-muted-foreground">{bahan?.satuan}</Label>
                        <div className="text-xs font-medium text-blue-600">{formatRupiah(hargaPerUnit)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveIngredient(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* HPP Display */}
            <div className="border-t pt-2 space-y-1">
              <Label className="text-xs">HPP Resep Terkalkulasi</Label>
              <div className="text-lg font-bold text-blue-600">{formatRupiah(currentHpp)}</div>
              {hppDiffers && (
                <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Berbeda dari HPP saat ini ({formatRupiah(editingProduct?.hpp || 0)})
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={updating}
            >
              Tutup
            </Button>
            <Button
              onClick={handleSaveResep}
              disabled={updating || ingredients.length === 0}
            >
              {updating ? 'Menyimpan...' : 'Simpan Resep'}
            </Button>
            <Button
              onClick={handleUpdateProductHpp}
              disabled={updating || !hppDiffers}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? 'Update...' : 'Perbarui HPP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
