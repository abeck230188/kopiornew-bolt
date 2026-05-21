import { useState, useEffect } from 'react';
import { getTransactionsByShift } from '@/lib/firestore';
import { formatRupiah, formatDateTime } from '@/lib/format';
import type { Transaction, Shift } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { History, Receipt, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  activeShift: Shift | null;
}

export default function RiwayatPage({ activeShift }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (activeShift) {
      getTransactionsByShift(activeShift.id).then(setTransactions);
    }
  }, [activeShift]);

  const visible = transactions.filter(
    (t) => t.status === 'paid' || t.status === 'voided'
  );

  if (!activeShift) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Buka shift terlebih dahulu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold">Riwayat Transaksi</h2>

      {visible.length === 0 ? (
        <Card className="border-amber-200">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Belum ada transaksi di shift ini</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.sort((a, b) => b.createdAt - a.createdAt).map((t) => {
            const isExpanded = expandedId === t.id;
            return (
              <Card key={t.id} className={`border-amber-200 ${t.status === 'voided' ? 'opacity-60' : ''}`}>
                <CardContent className="pt-4 py-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{formatDateTime(t.createdAt)}</p>
                        {t.status === 'voided' && <Badge variant="destructive" className="text-xs">VOID</Badge>}
                        {t.isKasbonSettlement && <Badge className="bg-amber-100 text-amber-700 text-xs">Kasbon Lunas</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.paymentMethod.toUpperCase()}
                        {t.customerName ? ` | ${t.customerName}` : ''}
                        {' | '}{t.items.length} item
                      </p>
                      {t.status === 'voided' && (
                        <p className="text-xs text-red-500">Alasan: {t.voidReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{formatRupiah(t.total)}</p>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-amber-100">
                      <div className="space-y-1.5">
                        {t.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{item.productName}</span>
                              <span className="text-muted-foreground ml-1">x{item.qty}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs text-muted-foreground">{formatRupiah(item.harga)} @</span>
                              <span className="font-medium ml-2">{formatRupiah(item.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-amber-100 flex justify-between text-sm font-bold">
                        <span>Total</span>
                        <span>{formatRupiah(t.total)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
