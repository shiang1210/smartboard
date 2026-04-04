import React from 'react';

export default function SystemHeader({ isDarkMode, setIsDarkMode, isManageMode, setIsManageMode, selectedIds, handleBatchArchive, handleBatchDelete, isProcessing, setIsTagManagerOpen, profile, todoStats, filter }) {
  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-slate-200/50'}`}>
      <div className="py-3 flex justify-between items-center flex-wrap gap-2 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">📋</div>
          <h1 className="text-lg font-black tracking-tighter hidden sm:block">資訊牆 V13.1</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.open(`?action=export`, '_blank')} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black transition-colors hover:bg-emerald-600">匯出 CSV</button>
          <button onClick={() => setIsTagManagerOpen(true)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>🏷️ 標籤管理</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>{isDarkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => setIsManageMode(!isManageMode)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${isManageMode ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}`}>批次管理</button>
          {profile && <img src={profile.pictureUrl} className="w-8 h-8 rounded-lg object-cover border border-slate-200" alt="" />}
        </div>
      </div>
      
      {filter !== '看板' && (filter === '全部' || filter === '待辦') && todoStats.total > 0 && (
        <div className="pb-3 px-5 max-w-7xl mx-auto">
          <div className="flex justify-between text-xs font-bold mb-1"><span className="text-slate-400">任務達成率</span><span className="text-indigo-500">{todoStats.percent}% ({todoStats.completed}/{todoStats.total})</span></div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${todoStats.percent}%` }}></div></div>
        </div>
      )}

      {isManageMode && (
        <div className={`py-2 border-t flex justify-between items-center px-4 max-w-7xl mx-auto ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-indigo-50/50'}`}>
          <span className="text-sm font-bold text-indigo-500">已選擇 {selectedIds.size} 筆</span>
          <div className="flex gap-2">
            <button onClick={handleBatchArchive} disabled={selectedIds.size === 0 || isProcessing} className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold disabled:opacity-50">封存選取</button>
            <button onClick={handleBatchDelete} disabled={selectedIds.size === 0 || isProcessing} className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold disabled:opacity-50">刪除選取</button>
          </div>
        </div>
      )}
    </header>
  );
}