export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary tracking-tight">STREAMR</h1>
          <p className="text-text-muted mt-2">Votre plateforme de streaming</p>
        </div>
        {children}
      </div>
    </div>
  );
}
