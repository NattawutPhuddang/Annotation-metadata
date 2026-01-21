import React, { useEffect, useState } from 'react';
import { BarChart2, Users, Trophy, TrendingUp } from 'lucide-react';
import { API_BASE } from '../../api/client'; // ใช้ API_BASE กลางที่เราสร้างไว้
import './DashboardPage.css';

interface UserStat {
  user: string;
  count: number;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard-stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const total = stats.reduce((acc, curr) => acc + curr.count, 0);
  const average = stats.length > 0 ? Math.round(total / stats.length) : 0;
  
  // Top 3 for Podium
  const top1 = stats[0];
  const top2 = stats[1];
  const top3 = stats[2];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
      Loading stats...
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-20">
      
      {/* Header Section */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-4 shadow-sm">
          <BarChart2 size={32} />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-2">
          Leaderboard
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto">
          Tracking the progress of our annotation heroes.
        </p>
      </div>

      {/* 🏆 Podium Section */}
      {stats.length > 0 && (
        <div className="podium-container">
          {/* Rank 2 */}
          {top2 && (
            <div className="podium-step rank-2 mt-8">
              <div className="podium-avatar">
                {top2.user.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs font-bold text-slate-500 mb-1">{top2.user}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{top2.count.toLocaleString()}</div>
              <div className="podium-base">2</div>
            </div>
          )}

          {/* Rank 1 */}
          {top1 && (
            <div className="podium-step rank-1">
              <div className="crown-icon">👑</div>
              <div className="podium-avatar">
                {top1.user.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs font-bold text-indigo-600 mb-1 bg-indigo-50 px-2 py-0.5 rounded-full">{top1.user}</div>
              <div className="text-xl font-black text-slate-800 dark:text-slate-900 mb-2">{top1.count.toLocaleString()}</div>
              <div className="podium-base">1</div>
            </div>
          )}

          {/* Rank 3 */}
          {top3 && (
            <div className="podium-step rank-3 mt-12">
              <div className="podium-avatar">
                {top3.user.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs font-bold text-slate-500 mb-1">{top3.user}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{top3.count.toLocaleString()}</div>
              <div className="podium-base">3</div>
            </div>
          )}
        </div>
      )}

      {/* 📊 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="stat-card-modern stat-theme-emerald">
           <Trophy size={120} className="stat-bg-icon text-emerald-600 dark:text-emerald-400" />
           <div className="relative z-10">
             <div className="flex justify-between items-start">
               <div className="icon-wrapper"><Trophy size={24} strokeWidth={2.5} /></div>
               <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">+Live</span>
             </div>
             <div>
               <div className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wide mb-1">Total Items</div>
               <div className="text-4xl font-black stat-value tracking-tight">{total.toLocaleString()}</div>
             </div>
           </div>
        </div>

        <div className="stat-card-modern stat-theme-blue">
           <Users size={120} className="stat-bg-icon text-blue-600 dark:text-blue-400" />
           <div className="relative z-10">
             <div className="flex justify-between items-start">
               <div className="icon-wrapper"><Users size={24} strokeWidth={2.5} /></div>
               <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Active</span>
             </div>
             <div>
               <div className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wide mb-1">Contributors</div>
               <div className="text-4xl font-black stat-value tracking-tight">{stats.length}</div>
             </div>
           </div>
        </div>

        <div className="stat-card-modern stat-theme-orange">
           <TrendingUp size={120} className="stat-bg-icon text-orange-600 dark:text-orange-400" />
           <div className="relative z-10">
             <div className="flex justify-between items-start">
               <div className="icon-wrapper"><TrendingUp size={24} strokeWidth={2.5} /></div>
               <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Avg.</span>
             </div>
             <div>
               <div className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wide mb-1">Avg. per User</div>
               <div className="text-4xl font-black stat-value tracking-tight">{average.toLocaleString()}</div>
             </div>
           </div>
        </div>
      </div>

      {/* 📋 Table */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-700 dark:text-slate-200">Full Rankings</h3>
            <span className="text-xs font-medium text-slate-400 bg-white dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600">Live Data</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="py-4 px-6 w-20 text-center text-xs font-bold text-slate-400 uppercase">Rank</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase">User</th>
              <th className="py-4 px-6 text-right text-xs font-bold text-slate-400 uppercase">Score</th>
              <th className="py-4 px-6 w-1/3 text-xs font-bold text-slate-400 uppercase hidden md:table-cell">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {stats.map((stat, idx) => (
              <tr 
                key={stat.user} 
                className={`group transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-700/50`}
              >
                <td className="py-4 px-6 text-center">
                  <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full font-bold text-sm
                    ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : 
                      idx === 1 ? 'bg-slate-200 text-slate-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' : 'text-slate-400 bg-slate-100 dark:bg-slate-700'}
                  `}>
                    {idx + 1}
                  </div>
                </td>
                
                <td className="py-4 px-6">
                   <div className="font-bold text-slate-700 dark:text-slate-200">
                     {stat.user}
                     {idx === 0 && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800">Winner</span>}
                   </div>
                </td>

                <td className="py-4 px-6 text-right">
                  <span className={`font-mono font-bold text-lg ${idx === 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {stat.count.toLocaleString()}
                  </span>
                </td>

                <td className="py-4 px-6 hidden md:table-cell">
                   <div className="flex items-center gap-3">
                     <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-500 group-hover:bg-indigo-400'
                          }`}
                          style={{ width: `${(stat.count / (stats[0]?.count || 1)) * 100}%` }}
                        />
                     </div>
                     <span className="text-xs text-slate-400 w-8 text-right">
                       {Math.round((stat.count / total) * 100)}%
                     </span>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;