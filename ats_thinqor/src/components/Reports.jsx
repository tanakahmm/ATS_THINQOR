import React, { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Download, ChevronRight, BarChart2, PieChart, Users, FileText, Briefcase, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useDispatch, useSelector } from "react-redux";
import { fetchReportClients, fetchReportRequirements, fetchReportStats, fetchReportStageCandidates } from "../auth/authSlice";

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const STATUS_COLORS = {
    'IN_PROGRESS': '#3B82F6', // Blue
    'COMPLETED': '#10B981',   // Emerald
    'REJECTED': '#EF4444',    // Red
    'PENDING': '#F59E0B',     // Amber
    'HOLD': '#6B7280'         // Gray
};

export default function Reports() {
    const dispatch = useDispatch();
    const { reportClients, reportRequirements, reportStats, loading, error } = useSelector((state) => state.auth);

    const [view, setView] = useState('CLIENTS'); // CLIENTS, REQUIREMENTS, STATS
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedReq, setSelectedReq] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [stageCandidates, setStageCandidates] = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    // Billing State (PRESERVED)
    const [ratePerCandidate, setRatePerCandidate] = useState(0);

    // Fetch Clients
    useEffect(() => {
        if (view === 'CLIENTS') {
            dispatch(fetchReportClients());
        } else if (view === 'REQUIREMENTS' && selectedClient) {
            dispatch(fetchReportRequirements(selectedClient.id));
        } else if (view === 'STATS' && selectedReq) {
            dispatch(fetchReportStats(selectedReq.id));
            setSelectedStage(null); // Reset stage selection
            setStageCandidates([]);
        }
    }, [view, selectedClient, selectedReq, dispatch]);

    // Fetch candidates when stage selected
    useEffect(() => {
        if (selectedReq && selectedStage) {
            setLoadingCandidates(true);
            dispatch(fetchReportStageCandidates({ reqId: selectedReq.id, stageName: selectedStage }))
                .unwrap()
                .then((data) => {
                    setStageCandidates(data);
                    setLoadingCandidates(false);
                })
                .catch(() => setLoadingCandidates(false));
        }
    }, [selectedStage, selectedReq, dispatch]);

    const handleClientClick = (client) => {
        setSelectedClient(client);
        setView('REQUIREMENTS');
    };

    const handleReqClick = (req) => {
        setSelectedReq(req);
        setView('STATS');
    };

    const handleBack = () => {
        if (view === 'STATS') {
            setView('REQUIREMENTS');
            setSelectedReq(null);
        } else if (view === 'REQUIREMENTS') {
            setView('CLIENTS');
            setSelectedClient(null);
        }
    };

    // Determine list data based on view
    const listData = view === 'CLIENTS' ? reportClients : (view === 'REQUIREMENTS' ? reportRequirements : []);

    // --- RENDER HELPERS ---

    const renderClients = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listData.map(client => (
                <div
                    key={client.id}
                    onClick={() => handleClientClick(client)}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition cursor-pointer group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                                <Briefcase size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">{client.name}</h3>
                                <p className="text-sm text-gray-500">View Requirements</p>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-indigo-600 transition" />
                    </div>
                </div>
            ))}
            {listData.length === 0 && !loading && (
                <div className="col-span-full text-center py-10 text-gray-400">No clients found.</div>
            )}
        </div>
    );

    const renderRequirements = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 cursor-pointer hover:text-indigo-600" onClick={handleBack}>
                <ArrowLeft size={16} /> Back to Clients
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Requirements for {selectedClient?.name}</h2>

            <div className="grid grid-cols-1 gap-4">
                {listData.map(req => (
                    <div
                        key={req.id}
                        onClick={() => handleReqClick(req)}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-100 transition cursor-pointer flex items-center justify-between group"
                    >
                        <div>
                            <h3 className="font-semibold text-gray-900 text-lg group-hover:text-indigo-600 transition">{req.title}</h3>
                            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${req.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {req.status}
                                </span>
                                <span>Created: {new Date(req.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-indigo-600 transition" />
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStats = () => {
        if (!reportStats) return null;
        const { requirement, stats, total_candidates } = reportStats;

        // Billing Calculation
        const totalCandidates = total_candidates || 0;
        const totalAmount = totalCandidates * ratePerCandidate;

        // --- Prepare Analytics Data ---

        // 1. Group by Stage Name & Order
        const stageGroups = {};
        stats.forEach(item => {
            if (!stageGroups[item.stage_name]) {
                stageGroups[item.stage_name] = {
                    name: item.stage_name,
                    order: item.stage_order || 999,
                    total: 0,
                    statusCounts: {}
                };
            }
            stageGroups[item.stage_name].total += item.count;
            stageGroups[item.stage_name].statusCounts[item.status] = (stageGroups[item.stage_name].statusCounts[item.status] || 0) + item.count;
        });

        // 2. Sort Stages by Order
        const sortedStages = Object.values(stageGroups).sort((a, b) => a.order - b.order);

        // 3. Funnel Data (Candidates per Round)
        const funnelData = sortedStages.map(stage => ({
            name: stage.name,
            candidates: stage.total
        }));

        // 4. Status Distribution for Selected Stage 
        let pieData = [];
        if (selectedStage) {
            const stageData = stageGroups[selectedStage];
            if (stageData) {
                pieData = Object.entries(stageData.statusCounts).map(([status, count]) => ({
                    name: status,
                    value: count
                }));
            }
        } else {
            // Overall Status Distribution
            const overallStatus = {};
            stats.forEach(item => {
                overallStatus[item.status] = (overallStatus[item.status] || 0) + item.count;
            });
            pieData = Object.entries(overallStatus).map(([status, count]) => ({
                name: status,
                value: count
            }));
        }

        // 5. KPIs
        // Use backend provided count for rigorous "Final Round Completed" check
        const completedCount = reportStats.selected_candidates || 0;
        const firstStageCount = sortedStages.length > 0 ? sortedStages[0].total : 0;
        const lastStageCount = sortedStages.length > 0 ? sortedStages[sortedStages.length - 1].total : 0;
        const dropOffRate = firstStageCount > 0 ? Math.round(((firstStageCount - lastStageCount) / firstStageCount) * 100) : 0;

        return (
            <div className="space-y-8 animate-fade-in">
                {/* Navigation Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <span className="cursor-pointer hover:text-indigo-600" onClick={() => { setView('CLIENTS'); setSelectedClient(null); }}>Clients</span>
                    <ChevronRight size={14} />
                    <span className="cursor-pointer hover:text-indigo-600" onClick={handleBack}>{selectedClient?.name}</span>
                    <ChevronRight size={14} />
                    <span className="font-medium text-gray-900">{requirement.title}</span>
                </div>

                {/* Top KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-gray-500 text-sm font-medium">Total Candidates</div>
                        <div className="text-3xl font-bold mt-2 text-gray-900">{total_candidates}</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-gray-500 text-sm font-medium">Rounds</div>
                        <div className="text-3xl font-bold mt-2 text-indigo-600">{sortedStages.length}</div>
                        <p className="text-xs text-gray-400 mt-1">{requirement.no_of_rounds} defined</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-gray-500 text-sm font-medium">Hired / Selected</div>
                        <div className="text-3xl font-bold mt-2 text-emerald-600">{completedCount}</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-gray-500 text-sm font-medium">Overall Drop-off</div>
                        <div className="text-3xl font-bold mt-2 text-red-500">{dropOffRate}%</div>
                        <p className="text-xs text-gray-400 mt-1">From first to last round</p>
                    </div>
                </div>

                {/* Billing Summary (PRESERVED) */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 billing-summary print:border print:border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                            Billing Summary
                        </h3>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 print:hidden">
                            Private / Admin Only
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div className="print:w-1/4">
                            <p className="text-sm text-gray-600">Candidates Assigned</p>
                            <p className="text-2xl font-bold text-gray-900">{totalCandidates}</p>
                        </div>
                        <div className="print:hidden">
                            <label className="block text-sm text-gray-600 mb-1">Rate per Candidate</label>
                            <input
                                type="number"
                                min="0"
                                value={ratePerCandidate}
                                onChange={(e) => setRatePerCandidate(Number(e.target.value))}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 bg-white"
                                placeholder="Enter rate"
                            />
                        </div>
                        <div className="hidden print:block print:w-1/4">
                            <p className="text-sm text-gray-600">Rate per Candidate</p>
                            <p className="text-2xl font-medium text-gray-900">₹{ratePerCandidate}</p>
                        </div>
                        <div className="print:w-1/4">
                            <p className="text-sm text-gray-600">Calculation</p>
                            <p className="text-sm font-medium text-gray-700">{totalCandidates} × {ratePerCandidate}</p>
                        </div>
                        <div className="print:w-1/4">
                            <p className="text-sm text-gray-600">Total Amount</p>
                            <p className="text-3xl font-bold text-indigo-700">₹{totalAmount.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Round Funnel Chart (Main) */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-2">Hiring Funnel</h3>
                        <p className="text-sm text-gray-500 mb-6">Candidates active or completed in each round</p>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={funnelData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCandidates" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                    <Area type="monotone" dataKey="candidates" stroke="#4F46E5" fillOpacity={1} fill="url(#colorCandidates)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Distribution (Contextual) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold mb-2">
                            {selectedStage ? `${selectedStage} Status` : 'Overall Status'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">Distribution of outcomes</p>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Round Drill-Down Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-800">Round Analysis</h3>
                        <p className="text-sm text-gray-500">Select a round below to view candidate details.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 min-h-[400px]">
                        {/* Sidebar: Rounds List */}
                        <div className="col-span-12 md:col-span-3 border-r border-gray-100 bg-gray-50/50">
                            <div className="py-2">
                                {sortedStages.map((stage) => (
                                    <div
                                        key={stage.name}
                                        onClick={() => setSelectedStage(stage.name)}
                                        className={`px-6 py-4 cursor-pointer border-l-4 transition-all hover:bg-white 
                                            ${selectedStage === stage.name
                                                ? 'border-indigo-600 bg-white text-indigo-700 font-medium shadow-sm'
                                                : 'border-transparent text-gray-600'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{stage.name}</span>
                                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{stage.total}</span>
                                        </div>
                                    </div>
                                ))}
                                {sortedStages.length === 0 && (
                                    <div className="px-6 py-4 text-gray-400 text-sm italic">No rounds data available yet.</div>
                                )}
                            </div>
                        </div>

                        {/* Main Content: Candidate List */}
                        <div className="col-span-12 md:col-span-9">
                            {!selectedStage ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10">
                                    <BarChart2 size={48} className="mb-4 text-gray-300" />
                                    <p>Select a round from the left to view candidates.</p>
                                </div>
                            ) : (
                                <div className="p-0">
                                    {loadingCandidates ? (
                                        <div className="p-10 flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-6 py-3 font-medium">Candidate Name</th>
                                                        <th className="px-6 py-3 font-medium">Email</th>
                                                        <th className="px-6 py-3 font-medium">Status</th>
                                                        <th className="px-6 py-3 font-medium">Last Updated</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {stageCandidates.map((candidate, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 transition">
                                                            <td className="px-6 py-4 font-medium text-gray-900">{candidate.name}</td>
                                                            <td className="px-6 py-4 text-gray-500">{candidate.email}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border
                                                                    ${candidate.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                                        candidate.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                            candidate.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                                'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                                    {candidate.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-400">
                                                                {candidate.updated_at ? new Date(candidate.updated_at).toLocaleDateString() : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {stageCandidates.length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                                                                No candidates found in this round.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <style>{`
                @media print {
                  header, button, .print\\:hidden { display: none !important; }
                  body { background: white; }
                  .billing-summary { page-break-inside: avoid; border: 1px solid #ddd; }
                  .print\\:block { display: block !important; }
                  .print\\:w-1\\/4 { width: 25% !important; }
                }
            `}</style>

            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 print:hidden">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {view !== 'CLIENTS' && (
                            <button onClick={handleBack} className="text-gray-500 hover:text-gray-800 transition">
                                <ArrowLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-2xl font-bold text-gray-800">
                            {view === 'CLIENTS' ? 'Reports & Analytics' :
                                view === 'REQUIREMENTS' ? 'Client Requirements' :
                                    'Requirement Analytics'}
                        </h1>
                    </div>
                    {view === 'STATS' && (
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                        >
                            <Download size={18} /> Export Report
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100 flex items-center gap-2">
                        <span>⚠️</span> Error: {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <>
                        {view === 'CLIENTS' && renderClients()}
                        {view === 'REQUIREMENTS' && renderRequirements()}
                        {view === 'STATS' && renderStats()}
                    </>
                )}
            </main>
        </div>
    );
}
