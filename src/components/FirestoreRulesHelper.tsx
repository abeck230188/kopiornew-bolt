import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Copy, CircleCheck as CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

const FIREBASE_CONSOLE_RULES_URL = 'https://console.firebase.google.com/project/kopiornew/firestore/rules';

// Composite index URL for shifts collection (kasirUid + status + openedAt)
const COMPOSITE_INDEX_URL = 'https://console.firebase.google.com/project/kopiornew/firestore/indexes';

export default function FirestoreRulesHelper() {
  const [copied, setCopied] = useState(false);

  const copyRules = async () => {
    try {
      await navigator.clipboard.writeText(FIRESTORE_RULES);
      setCopied(true);
      toast.success('Rules disalin ke clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Gagal menyalin. Salin manual dari teks di bawah.');
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          Firestore Security Rules
        </CardTitle>
        <CardDescription className="text-xs">
          Aturan ini harus diterapkan di Firebase Console sebelum membuat admin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-white rounded-lg border border-amber-200 p-3 font-mono text-xs overflow-x-auto whitespace-pre">
          {FIRESTORE_RULES}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={copyRules} className="flex-1">
            {copied ? <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? 'Tersalin!' : 'Salin Rules'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(FIREBASE_CONSOLE_RULES_URL, '_blank')} className="flex-1">
            <ExternalLink className="h-3 w-3 mr-1" />
            Buka Firebase Console
          </Button>
        </div>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
          <li>Salin rules di atas atau klik "Salin Rules"</li>
          <li>Buka Firebase Console dengan tombol di atas</li>
          <li>Tempel rules dan klik "Publish"</li>
          <li>Kembali ke sini dan buat admin</li>
        </ol>
        <div className="bg-white rounded-lg border border-amber-200 p-2">
          <p className="text-xs text-amber-700 font-medium">Opsional - Composite Index</p>
          <p className="text-xs text-muted-foreground mt-1">
            Untuk performa optimal, buat composite index di Firestore. Aplikasi sudah otomatis fallback jika index belum ada.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs mt-1 h-6 px-2"
            onClick={() => window.open(COMPOSITE_INDEX_URL, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Buka halaman Indexes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
