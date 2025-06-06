import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function Agents() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 overflow-auto bg-slate-50">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">AI Agents</h1>
            <p className="text-slate-600 mt-1">Manage your automated browser agents</p>
          </div>

          {/* This would contain the full agents management interface */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">Agents management interface will be implemented here</p>
          </div>
        </main>
      </div>
    </div>
  );
}
