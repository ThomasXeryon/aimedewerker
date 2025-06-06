import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function Tasks() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-6 overflow-auto bg-slate-50">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Task Queue</h1>
            <p className="text-slate-600 mt-1">Monitor task execution and history</p>
          </div>

          {/* This would contain the task queue interface */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-500">Task queue interface will be implemented here</p>
          </div>
        </main>
      </div>
    </div>
  );
}
