import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
  // params prop removed as it's not used in this component
}) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4"> {/* Removed pattern classes, added relative */}
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="relative h-full w-full [&>div]:absolute [&>div]:inset-0 [&>div]:bg-[radial-gradient(circle_at_center,hsl(var(--primary)),transparent)] [&>div]:opacity-30 [&>div]:mix-blend-multiply">
          <div></div>
        </div>
      </div>
      
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
