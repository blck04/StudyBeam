import { Brain } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSizeClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-xl';
  const iconSize = size === 'lg' ? 30 : size === 'md' ? 24 : 20;

  return (
    <Link href="/" className="flex items-center gap-2 group/logo">
      <Brain className={cn("text-primary transition-colors duration-200")} size={iconSize} />
      <h1 className={cn("font-headline font-semibold text-gradient", textSizeClass)}>
        StudyBeam
      </h1>
    </Link>
  );
}
