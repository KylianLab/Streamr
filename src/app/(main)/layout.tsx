import { Navbar } from "@/components/layout/navbar";
import { ToastContainer } from "@/components/ui/toast";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">{children}</main>
      <ToastContainer />
    </>
  );
}
