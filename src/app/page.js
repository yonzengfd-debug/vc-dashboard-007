'use client';

import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { dataService } from '@/services/dataService';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Package, 
  Filter, 
  RefreshCcw,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Sparkles,
  Cpu,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  Brain,
  Info
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

export default function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [apiKeyError, setApiKeyError] = useState(false);
  
  const GEMINI_MODELS = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Latest)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ];
  
  // Filter states
  const [productFilter, setProductFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await dataService.fetchSalesData();
        setRawData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Get unique products and channels for filters
  const products = useMemo(() => ['All', ...new Set(rawData.map(row => row.product))], [rawData]);
  const channels = useMemo(() => ['All', ...new Set(rawData.map(row => row.channel))], [rawData]);

  // Filtered data
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchProduct = productFilter === 'All' || row.product === productFilter;
      const matchChannel = channelFilter === 'All' || row.channel === channelFilter;
      return matchProduct && matchChannel;
    });
  }, [rawData, productFilter, channelFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const revenue = filteredData.reduce((acc, row) => acc + (Number(row.revenue) || 0), 0);
    const cost = filteredData.reduce((acc, row) => acc + (Number(row.cost) || 0), 0);
    const profit = revenue - cost;
    const orders = filteredData.reduce((acc, row) => acc + (Number(row.orders) || 0), 0);
    const aov = orders > 0 ? revenue / orders : 0;

    return {
      revenue,
      orders,
      profit,
      aov,
      cards: [
        { title: 'Total Revenue', value: `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign className="w-5 h-5 text-blue-500" /> },
        { title: 'Total Orders', value: orders.toLocaleString(), icon: <ShoppingCart className="w-5 h-5 text-emerald-500" /> },
        { title: 'Total Profit', value: `$${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp className="w-5 h-5 text-indigo-500" /> },
        { title: 'Average Order Value', value: `$${aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <Package className="w-5 h-5 text-rose-500" /> },
      ]
    };
  }, [filteredData]);

  // Direct Data Insights
  const simpleInsights = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    // Best Product
    const pRev = filteredData.reduce((acc, row) => {
      acc[row.product] = (acc[row.product] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    const bestProduct = Object.entries(pRev).sort((a,b) => b[1] - a[1])[0]?.[0];

    // Best Channel
    const cRev = filteredData.reduce((acc, row) => {
      acc[row.channel] = (acc[row.channel] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    const bestChannel = Object.entries(cRev).sort((a,b) => b[1] - a[1])[0]?.[0];

    // Highest Revenue Day
    const dRev = filteredData.reduce((acc, row) => {
      acc[row.date] = (acc[row.date] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    const bestDay = Object.entries(dRev).sort((a,b) => b[1] - a[1])[0]?.[0];

    // Highest Conversion Rate Channel
    const cConv = filteredData.reduce((acc, row) => {
      if (!acc[row.channel]) acc[row.channel] = { o: 0, v: 0 };
      acc[row.channel].o += (Number(row.orders) || 0);
      acc[row.channel].v += (Number(row.visitors) || 0);
      return acc;
    }, {});
    const bestConvChannel = Object.entries(cConv)
      .map(([name, stats]) => ({ name, cr: stats.v > 0 ? stats.o / stats.v : 0 }))
      .sort((a,b) => b.cr - a.cr)[0]?.name;

    return [
      { label: 'Best Product', value: bestProduct, icon: <Package className="w-4 h-4" /> },
      { label: 'Top Channel', value: bestChannel, icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'Peak Sales Day', value: bestDay, icon: <DollarSign className="w-4 h-4" /> },
      { label: 'Highest Conv.', value: bestConvChannel, icon: <TrendingUp className="w-4 h-4" /> }
    ];
  }, [filteredData]);

  // AI Insight Generation
  const generateAiInsights = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      setApiKeyError(true);
      return;
    }
    setApiKeyError(false);
    setAiLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: selectedModel });

      const prompt = `As a business analyst, analyze these metrics from our sales data:
Total Revenue: $${kpis.revenue.toFixed(2)}
Total Orders: ${kpis.orders}
Total Profit: $${kpis.profit.toFixed(2)}
Average Order Value: $${kpis.aov.toFixed(2)}
Best Product: ${simpleInsights[0]?.value}
Top Marketing Channel: ${simpleInsights[1]?.value}
Peak Sales Day: ${simpleInsights[2]?.value}
Highest Converting Channel: ${simpleInsights[3]?.value}

Please provide 3 very short, clear points for each of these categories:
1. Alerts (Critical issues or risks)
2. Opportunities (Growth potential)
3. Suggestions (Actionable next steps)

Keep each point under 100 characters. Return the response in a structured JSON format like this:
{ "alerts": ["...", "...", "..."], "opportunities": ["...", "...", "..."], "suggestions": ["...", "...", "..."] }
Only return the JSON.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(responseText);
      setAiResponse(parsed);
    } catch (error) {
      console.error("AI Error:", error);
      setAiResponse({ 
        alerts: ["Service currently unavailable. Check your API key."], 
        opportunities: ["Try again later."], 
        suggestions: ["Verify your Gemini limits."] 
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Chart: Revenue Trend by Date
  const trendData = useMemo(() => {
    const dailyMap = filteredData.reduce((acc, row) => {
      const date = row.date;
      acc[date] = (acc[date] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    return Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));
  }, [filteredData]);

  // Chart: Revenue by Channel
  const channelData = useMemo(() => {
    const channelMap = filteredData.reduce((acc, row) => {
      const channel = row.channel;
      acc[channel] = (acc[channel] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    return Object.entries(channelMap).map(([name, revenue]) => ({ name, revenue }));
  }, [filteredData]);

  // Chart: Top Products by Revenue
  const productData = useMemo(() => {
    const productMap = filteredData.reduce((acc, row) => {
      const product = row.product;
      acc[product] = (acc[product] || 0) + (Number(row.revenue) || 0);
      return acc;
    }, {});
    return Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => ({ name, revenue }));
  }, [filteredData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium animate-pulse">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];

  const ChartContainer = ({ title, icon, children }) => (
    <div className="bg-white rounded-2xl p-6 shadow-[0px_2px_10px_rgba(0,0,0,0.02)] border border-slate-200">
      <div className="flex items-center space-x-2 mb-6">
        <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
          {icon}
        </div>
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Sales Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time performance metrics and sales trends</p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-2 px-4 rounded-2xl border border-slate-200 shadow-[0px_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filters:</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1 mb-0.5">Product</span>
                <select 
                  value={productFilter} 
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="bg-slate-50 border-none rounded-lg text-sm font-semibold px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 ml-1 mb-0.5">Channel</span>
                <select 
                  value={channelFilter} 
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="bg-slate-50 border-none rounded-lg text-sm font-semibold px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {channels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <button 
                onClick={() => { setProductFilter('All'); setChannelFilter('All'); }}
                className="mt-4 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Reset Filters"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {kpis.cards.map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-[0px_2px_10px_rgba(0,0,0,0.02)] border border-slate-200 hover:border-indigo-100 hover:shadow-[0px_6px_20px_rgba(0,0,0,0.04)] transition-all duration-300 group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">{kpi.title}</p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">{kpi.value}</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-indigo-50 group-hover:scale-110 transition-all">
                  {kpi.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data-Driven Insights Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {simpleInsights.map((insight, idx) => (
            <div key={idx} className="bg-slate-50/50 backdrop-blur-sm rounded-xl p-4 border border-slate-200 flex items-center space-x-4 transition-all hover:bg-white hover:shadow-sm">
              <div className="p-2 bg-white rounded-lg shadow-xs text-slate-500">
                {insight.icon}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">{insight.label}</p>
                <p className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{insight.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1: Main Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartContainer title="Revenue Trend" icon={<LineChartIcon className="w-4 h-4" />}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ChartContainer>
          </div>

          <ChartContainer title="Revenue by Channel" icon={<PieChartIcon className="w-4 h-4" />}>
            <BarChart data={channelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                width={100}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                {channelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f43f5e', '#f59e0b'][index % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* AI Business Insights Section */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 p-12 bg-indigo-500/10 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 p-12 bg-blue-500/10 blur-[100px] rounded-full"></div>
          
          <div className="flex flex-col lg:flex-row gap-8 relative z-10">
            {/* Left Column: Controls */}
            <div className="lg:w-1/3 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-indigo-200 text-xs font-bold uppercase tracking-widest mb-4">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Business Intelligence</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 leading-tight">Smart Analysis</h2>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                  Analyze performance metrics using Google Gemini to reveal growth opportunities and risks.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Model</label>
                  <div className="grid grid-cols-1 gap-2">
                    {GEMINI_MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
                          selectedModel === model.id 
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)]' 
                          : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Cpu className={`w-4 h-4 ${selectedModel === model.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                          <span className="text-xs font-bold">{model.name}</span>
                        </div>
                        {selectedModel === model.id && <ChevronRight className="w-3 h-3 text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateAiInsights}
                  disabled={aiLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-950/50 flex items-center justify-center space-x-2 group active:scale-[0.98]"
                >
                  {aiLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="text-sm">Analyzing...</span>
                    </div>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span>Generate Business Insights</span>
                    </>
                  )}
                </button>

                {apiKeyError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">API Key Required</p>
                      <p className="text-[10px] text-rose-300/60 mt-0.5 leading-tight">
                        Add <code className="bg-black/30 px-1 py-0.5 rounded text-white">NEXT_PUBLIC_GEMINI_API_KEY</code> to your environment variables.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Results */}
            <div className="lg:w-2/3">
              {aiResponse ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                    <div className="flex items-center space-x-2 mb-4 text-rose-400">
                      <AlertCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-[10px] font-black uppercase tracking-[2px]">Alerts</h3>
                    </div>
                    <ul className="space-y-4">
                      {aiResponse.alerts.map((item, i) => (
                        <li key={i} className="text-xs text-slate-300 border-l-2 border-rose-500/20 pl-3 py-1 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                    <div className="flex items-center space-x-2 mb-4 text-emerald-400">
                      <TrendingUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-[10px] font-black uppercase tracking-[2px]">Opportunities</h3>
                    </div>
                    <ul className="space-y-4">
                      {aiResponse.opportunities.map((item, i) => (
                        <li key={i} className="text-xs text-slate-300 border-l-2 border-emerald-500/20 pl-3 py-1 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                    <div className="flex items-center space-x-2 mb-4 text-amber-400">
                      <Lightbulb className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-[10px] font-black uppercase tracking-[2px]">Suggestions</h3>
                    </div>
                    <ul className="space-y-4">
                      {aiResponse.suggestions.map((item, i) => (
                        <li key={i} className="text-xs text-slate-300 border-l-2 border-amber-500/20 pl-3 py-1 leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[300px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-black/20">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-indigo-400/30">
                    <Brain className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-slate-300 font-bold text-sm mb-1">Intelligence Engine Offline</h3>
                  <p className="text-slate-500 text-xs max-w-[200px] leading-relaxed">
                    {aiLoading ? "Gemini is processing your metrics..." : "Generate AI-powered insights to optimize your business strategy."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2: Top Products */}
        <div className="grid grid-cols-1 gap-6">
          <ChartContainer title="Top Products by Revenue" icon={<BarChart3 className="w-4 h-4" />}>
            <BarChart data={productData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40}>
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-[0px_2px_10px_rgba(0,0,0,0.02)] border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
            <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
                Showing {filteredData.length} of {rawData.length}
              </span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 py-1.5 px-3 rounded-full">
                {filteredData.length} records found
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors group">
                    {columns.map((col) => {
                      const val = row[col];
                      const displayVal = val !== null && val !== undefined ? String(val) : '-';
                      const isNumeric = col === 'revenue' || col === 'cost';
                      
                      return (
                        <td key={col} className={`px-6 py-4 text-slate-600 whitespace-nowrap ${isNumeric ? 'font-mono font-medium' : ''}`}>
                          {isNumeric ? `$${Number(displayVal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center">
                        <Filter className="w-8 h-8 mb-3 opacity-20" />
                        <p>No transactions match your current filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
