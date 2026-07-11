export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm font-medium text-slate-400 mb-2">Pending Fulfillments</div>
          <div className="text-4xl font-bold text-white">12</div>
          <div className="text-sm text-amber-500 mt-2 font-medium">Require attention</div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm font-medium text-slate-400 mb-2">Active AI Chats</div>
          <div className="text-4xl font-bold text-white">47</div>
          <div className="text-sm text-emerald-400 mt-2 font-medium">All handling automatically</div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm font-medium text-slate-400 mb-2">Daily Booking Volume</div>
          <div className="text-4xl font-bold text-white">₦4.2M</div>
          <div className="text-sm text-emerald-400 mt-2 font-medium">+14% from yesterday</div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-4 min-h-[400px]">
        <h2 className="text-xl font-bold mb-4">Recent QStash Jobs</h2>
        <div className="text-slate-400 text-sm">
          No failed jobs in the Dead Letter Queue (DLQ). The system is healthy.
        </div>
      </div>
    </div>
  );
}
