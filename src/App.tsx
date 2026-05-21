import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppShell from '@/components/AppShell';

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <AppShell />
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
