import Link from "next/link";
import { FlaskConical, Receipt, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-6 p-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">SF</span>
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">TaxEazy</h1>
            <p className="text-sm text-slate-500">SunForest X Therapeutics</p>
          </div>
        </div>
        <h2 className="text-4xl font-bold text-slate-900">
          Finance & R&D Intelligence
        </h2>
        <p className="text-xl text-slate-600 max-w-md mx-auto">
          Internal platform for managing transactions, GST/BAS compliance, and R&D tax incentives
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium shadow-sm"
          >
            Sign In
          </Link>
        </div>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl px-4">
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-teal-200 transition-colors">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Receipt className="h-5 w-5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-2">Finance</h3>
          <p className="text-sm text-slate-600">
            Track transactions, GST/BAS, and PAYG withholding
          </p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-teal-200 transition-colors">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <FlaskConical className="h-5 w-5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-2">R&D Projects</h3>
          <p className="text-sm text-slate-600">
            Manage projects, activities, and evidence for tax incentives
          </p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200 hover:border-teal-200 transition-colors">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-2">Compliance</h3>
          <p className="text-sm text-slate-600">
            Audit logs, exception tracking, and monthly reports
          </p>
        </div>
      </div>
    </div>
  );
}
