import React, { useState, useEffect } from 'react';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  HCDActivityReportingOverview,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Layers,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface ReportsExportsTabProps {
  activities: StateHCDActivity[];
  actionItems: StateHCDActivityActionItem[];
}

export const ReportsExportsTab: React.FC<ReportsExportsTabProps> = ({
  activities,
  actionItems,
}) => {
  const [overviewItems, setOverviewItems] = useState<HCDActivityReportingOverview[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewLevel, setOverviewLevel] = useState<'all' | 'lga' | 'state'>('all');
  const [overviewSearch, setOverviewSearch] = useState('');

  // Fetch consolidated overview view
  const loadOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await stateActivitiesService.fetchConsolidatedOverview({
        reportingLevel: overviewLevel,
      });
      if (res.success) {
        setOverviewItems(res.data);
      }
    } catch (err) {
      console.warn('Failed to load consolidated overview:', err);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [overviewLevel]);

  // Map of activities for action points export
  const activitiesMap = new Map(activities.map((a) => [a.id, a]));

  // Export handlers
  const handleExportActivitiesCsv = () => {
    const csv = stateActivitiesService.exportStateActivitiesCsv(activities);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `state-hcd-activities-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActionItemsCsv = () => {
    const csv = stateActivitiesService.exportActionItemsCsv(actionItems, activitiesMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `state-hcd-action-commitments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportConsolidatedCsv = () => {
    const csv = stateActivitiesService.exportConsolidatedOverviewCsv(overviewItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aks-hcd-consolidated-reporting-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintBriefing = () => {
    window.print();
  };

  // Filtered overview rows
  const filteredOverview = overviewItems.filter((item) => {
    if (!overviewSearch.trim()) return true;
    const term = overviewSearch.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(term) ||
      item.activity_id.toLowerCase().includes(term) ||
      (item.lga_name && item.lga_name.toLowerCase().includes(term)) ||
      item.activity_category.toLowerCase().includes(term)
    );
  });

  const lgaRecordsCount = overviewItems.filter((i) => i.reporting_level === 'lga').length;
  const stateRecordsCount = overviewItems.filter((i) => i.reporting_level === 'state').length;

  return (
    <div className="space-y-6">
      {/* Export Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: State Activities Register */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Formula Protected
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">State Activities Register</h4>
            <p className="text-xs text-slate-500 mt-1">
              Full dataset of state-level M&E activities, council meetings, and partnerships with complete stakeholder counts.
            </p>
            <div className="mt-3 text-xs text-slate-600 font-semibold">
              Available Records: <span className="text-emerald-800 font-bold">{activities.length}</span>
            </div>
          </div>
          <button
            onClick={handleExportActivitiesCsv}
            disabled={activities.length === 0}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV / Excel</span>
          </button>
        </div>

        {/* Card 2: Action Points & Commitments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Action Register
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Action Points Register</h4>
            <p className="text-xs text-slate-500 mt-1">
              Follow-up resolutions, responsible MDAs, assigned personnel, fulfillment deadlines, and completion remarks.
            </p>
            <div className="mt-3 text-xs text-slate-600 font-semibold">
              Available Action Items: <span className="text-amber-800 font-bold">{actionItems.length}</span>
            </div>
          </div>
          <button
            onClick={handleExportActionItemsCsv}
            disabled={actionItems.length === 0}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Download Action Points</span>
          </button>
        </div>

        {/* Card 3: Official Executive Briefing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Printer className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                Print & PDF
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Executive Print Briefing</h4>
            <p className="text-xs text-slate-500 mt-1">
              Formatted state summary report with official Akwa Ibom State letterhead for Executive Cabinet briefings.
            </p>
            <div className="mt-3 text-xs text-slate-600 font-semibold">
              Ready for immediate printing or PDF export
            </div>
          </div>
          <button
            onClick={handlePrintBriefing}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Executive Briefing</span>
          </button>
        </div>
      </div>

      {/* Consolidated Reporting Overview View (Cross-level LGA + State) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 mb-1">
              <Layers className="w-3 h-3 text-emerald-700" />
              Database View: public.hcd_activity_reporting_overview
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Consolidated Cross-Level Reporting Overview (LGA vs State)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Read-only aggregate reconciling both 31-LGA grassroots interventions and State-level executive activities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportConsolidatedCsv}
              disabled={overviewItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export View</span>
            </button>
            <button
              onClick={loadOverview}
              disabled={isLoadingOverview}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              title="Refresh Consolidated View"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingOverview ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Level Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setOverviewLevel('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                overviewLevel === 'all'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Levels ({overviewItems.length})
            </button>
            <button
              onClick={() => setOverviewLevel('state')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                overviewLevel === 'state'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              State-Level ({stateRecordsCount})
            </button>
            <button
              onClick={() => setOverviewLevel('lga')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                overviewLevel === 'lga'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              LGA-Level ({lgaRecordsCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search consolidated..."
              value={overviewSearch}
              onChange={(e) => setOverviewSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Overview Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Level</th>
                <th className="px-3.5 py-2.5">Activity ID</th>
                <th className="px-3.5 py-2.5">Title</th>
                <th className="px-3.5 py-2.5">Category / Pillar</th>
                <th className="px-3.5 py-2.5">Location / LGA</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingOverview ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-slate-500">
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                    Querying public.hcd_activity_reporting_overview...
                  </td>
                </tr>
              ) : filteredOverview.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-slate-400">
                    No matching records found in consolidated view
                  </td>
                </tr>
              ) : (
                filteredOverview.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2 whitespace-nowrap">
                      {row.reporting_level === 'state' ? (
                        <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                          STATE
                        </span>
                      ) : (
                        <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200">
                          LGA
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {row.activity_id}
                    </td>
                    <td className="px-3.5 py-2 font-semibold text-slate-800 max-w-xs truncate" title={row.title}>
                      {row.title}
                    </td>
                    <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">
                      {row.activity_category}
                    </td>
                    <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">
                      {row.lga_name || row.location || 'State-Wide'}
                    </td>
                    <td className="px-3.5 py-2 text-slate-500 whitespace-nowrap">
                      {row.activity_date}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap">
                      <span className="font-semibold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {row.activity_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
