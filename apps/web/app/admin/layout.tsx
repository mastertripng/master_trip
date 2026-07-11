import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | Master-Trip",
  description: "Internal operations and management dashboard.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-50">
      {/* Sidebar Placeholder */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-4">
        <div className="font-bold text-xl tracking-tight mb-8 text-blue-400">Master-Trip Ops</div>
        <nav className="flex flex-col gap-2">
          <div className="px-3 py-2 bg-slate-800 rounded-md text-sm font-medium">Dashboard</div>
          <div className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium cursor-pointer transition-colors">Bookings</div>
          <div className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium cursor-pointer transition-colors">Fulfillment</div>
          <div className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium cursor-pointer transition-colors">Markup Engine</div>
          <div className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium cursor-pointer transition-colors">Support AI</div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header Placeholder */}
        <header className="h-16 border-b border-slate-800 flex items-center px-8 justify-between shrink-0">
          <div className="text-sm font-medium text-slate-400">Operations Overview</div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">AD</div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
