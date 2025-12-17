import { Spinner } from '@/components/ui/spinner';

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
