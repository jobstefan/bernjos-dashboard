import { getCurrentRole } from "@/lib/auth/rbac";
import { Sidebar, MobileTopbar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getCurrentRole();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="md:pl-64">
        <MobileTopbar role={role} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
