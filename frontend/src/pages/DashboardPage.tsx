import React, { useEffect, useState } from 'react';
import { BarChart, Users, Trophy } from 'lucide-react';

interface UserStat {
  user: string;
  count: number;
}

interface Props {
  apiBase: string;
}

export const DashboardPage: React.FC<Props> = ({ apiBase }) => {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiBase}/api/dashboard-stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [apiBase]);

  const total = stats.reduce((acc, curr) => acc + curr.count, 0);

  if (loading) return <div className="p-10 text-center text-slate-400">Loading stats...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
          <BarChart size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Leaderboard Dashboard</h2>
          <p className="text-slate-500 text-sm">สถิติการตรวจสอบข้อมูลรายบุคคล</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
           <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
             <Trophy size={28} />
           </div>
           <div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Corrected</div>
             <div className="text-3xl font-bold text-slate-800">{total} <span className="text-sm font-normal text-slate-400">items</span></div>
           </div>
        </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
           <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
             <Users size={28} />
           </div>
           <div>
             <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Contributors</div>
             <div className="text-3xl font-bold text-slate-800">{stats.length} <span className="text-sm font-normal text-slate-400">users</span></div>
           </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 w-20 text-center text-xs font-bold text-slate-500 uppercase">Rank</th>
              <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase">User ID</th>
              <th className="py-4 px-6 text-right text-xs font-bold text-slate-500 uppercase">Correct Items</th>
              <th className="py-4 px-6 w-1/3 text-xs font-bold text-slate-500 uppercase">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.map((stat, idx) => (
              <tr key={stat.user} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 text-center">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="text-slate-400 font-mono">{idx + 1}</span>}
                </td>
                <td className="py-4 px-6 font-medium text-slate-700">{stat.user}</td>
                <td className="py-4 px-6 text-right font-bold text-emerald-600">{stat.count}</td>
                <td className="py-4 px-6">
                   <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${idx === 0 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                        style={{ width: `${(stat.count / (stats[0]?.count || 1)) * 100}%` }}
                      />
                   </div>
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">ยังไม่มีข้อมูลการทำงาน</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;