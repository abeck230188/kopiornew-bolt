import { Menu, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: Props) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-primary text-primary-foreground flex items-center justify-between px-4 py-3 shadow-md">
      <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <Coffee className="h-5 w-5" />
        <span className="font-display font-bold">Kopi Or New</span>
      </div>
      <div className="w-10" />
    </header>
  );
}
