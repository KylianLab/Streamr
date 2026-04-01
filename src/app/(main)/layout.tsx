import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { ToastContainer } from "@/components/ui/toast";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense><Navbar /></Suspense>
      <main className="min-h-screen pt-16">{children}</main>
      <ToastContainer />
    </>
  );
}
