import React from 'react';

export default function FilterPanel({ filter, setFilter, subcategories, subFilter, setSubFilter, keyword, setKeyword, startDate, setStartDate, endDate, setEndDate, showAdvanced, setShowAdvanced, handleSearch, isDarkMode }) {
  return (
    <div className="pb-3 flex flex-col sm:flex-row gap-3 sm:items-start justify-between w-full">
      <div className="flex flex-col w-full">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
          {['全部', '看板', '待辦', '行程', '好文', '檔案'].map(t => (
            <button key={t} onClick={() => { setFilter(t); setSubFilter('全部'); }} className={`px-4 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${filter === t ? 'bg-indigo-600 text-white shadow-md' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border border-slate-200/60')}`}>{t}</button>
          ))}
        </div>
        {filter === '好文' && subcategories.length > 1 && (
          <div className="pt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {subcategories.map(sub => (
              <button key={sub} onClick={() => setSubFilter(sub)} className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${subFilter === sub ? 'bg-emerald-500 text-white' : (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500')}`}># {sub}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋關鍵字..." className={`px-3 py-1.5 rounded-lg text-sm focus:outline-none flex-1 sm:w-48 transition-colors ${isDarkMode ? 'bg-slate-800 text-white border-slate-700' : 'bg-white border-slate-200'}`} />
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${showAdvanced ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>進階</button>
          <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold">搜尋</button>
        </form>
        {showAdvanced && (
          <div className={`flex gap-2 p-2 rounded-lg text-xs w-full animate-fade-in ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-slate-500 font-bold">開始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`px-2 py-1 rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-slate-500 font-bold">結束日期</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`px-2 py-1 rounded border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}