// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPMIeiPEvlGa4o5fs2ea3sWqtISn4bVp2G7S3HV1t-acgFozmRZvCIDe5qXKc8nUBkHQ/exec';
const LIFF_ID = '2009406684-H9fk9ysT';

// ─── IndexedDB 快取 ────────────────────────────────────────────
const initDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open('InfoWallDB', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('cacheStore');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const saveToIDB = async (key, data) => {
  try {
    const db = await initDB();
    const tx = db.transaction('cacheStore', 'readwrite');
    tx.objectStore('cacheStore').put(data, key);
  } catch(e) {}
};

const getFromIDB = async (key) => {
  try {
    const db = await initDB();
    return new Promise(resolve => {
      const tx = db.transaction('cacheStore', 'readonly');
      const req = tx.objectStore('cacheStore').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch(e) { return null; }
};

// ─── 工具函式 ──────────────────────────────────────────────────
const getThumbnail = (url) => {
  if (!url || !url.includes('drive.google.com')) return null;
  const match = url.match(/\/d\/(.+?)\//) || url.match(/id=(.+?)(&|$)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400` : null;
};

const generateCalendarUrl = (title, details) => {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', title || '');
  url.searchParams.append('details', details || '');
  return url.toString();
};

const getTags = (subcatStr) => {
  if (!subcatStr) return [];
  return subcatStr.split(/[,、]/).map(s => s.trim()).filter(Boolean);
};

const handleOpenUrl = (e, url) => {
  e.stopPropagation();
  if (!url || url === '#') return;
  if (window.liff && window.liff.isInClient()) window.liff.openWindow({ url: url, external: false });
  else window.open(url, '_blank');
};

// ─── Undo Store ────────────────────────────────────────────────
const useUndoStore = (() => {
  let listeners = [];
  let stack = [];
  const notify = () => listeners.forEach(fn => fn([...stack]));
  return {
    subscribe: (fn) => { listeners.push(fn); return () => { listeners = listeners.filter(l => l !== fn); }; },
    push: (entry) => { stack = [entry, ...stack].slice(0, 20); notify(); },
    pop: () => { const e = stack[0]; stack = stack.slice(1); notify(); return e; },
    clear: () => { stack = []; notify(); },
    getStack: () => [...stack],
  };
})();

// ─── LazyImage ────────────────────────────────────────────────
const LazyImage = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsLoaded(true); observer.disconnect(); }
    });
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div ref={imgRef} className={`w-full h-full bg-slate-200 dark:bg-slate-700 ${!isLoaded ? 'animate-pulse' : ''}`}>
      {isLoaded && <img src={src} alt={alt} className={className} />}
    </div>
  );
};

// ─── UndoToast ────────────────────────────────────────────────
const UndoToast = ({ isDarkMode }) => {
  const [stack, setStack] = useState([]);
  const timersRef = useRef({});

  useEffect(() => {
    const unsub = useUndoStore.subscribe(setStack);
    return unsub;
  }, []);

  const handleUndo = (entry) => {
    clearTimeout(timersRef.current[entry.id]);
    useUndoStore.pop();
    entry.undo();
  };

  useEffect(() => {
    if (stack.length === 0) return;
    const entry = stack[0];
    if (entry.autoRemove) {
      const t = setTimeout(() => useUndoStore.pop(), 6000);
      timersRef.current[entry.id] = t;
      return () => clearTimeout(t);
    }
  }, [stack]);

  if (stack.length === 0) return null;
  const entry = stack[0];

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold transition-all animate-fade-in ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
      <span>{entry.label}</span>
      <button onClick={() => handleUndo(entry)} className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-500 transition-colors">↩ 撤銷</button>
      <button onClick={() => useUndoStore.pop()} className={`px-2 py-1 rounded-xl text-xs transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
    </div>
  );
};

// ─── SystemHeader ─────────────────────────────────────────────
const SystemHeader = ({ pwaPrompt, installPWA, isDarkMode, setIsDarkMode, isManageMode, setIsManageMode, selectedIds, handleBatchArchive, handleBatchDelete, isProcessing, setIsTagManagerOpen, profile, todoStats, filter }) => (
  <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-slate-200/50'}`}>
    <div className="py-3 flex justify-between items-center flex-wrap gap-2 px-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">📋</div>
        <h1 className="text-lg font-black tracking-tighter hidden sm:block">資訊牆 V13.1</h1>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {pwaPrompt && <button onClick={installPWA} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-black transition-colors hover:bg-blue-600">📥 安裝桌面版</button>}
        <button onClick={() => window.open(`${GAS_URL}?action=export`, '_blank')} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black transition-colors hover:bg-emerald-600">匯出 CSV</button>
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

// ─── FilterPanel ──────────────────────────────────────────────
const FilterPanel = ({ filter, setFilter, subcategories, subFilter, setSubFilter, keyword, setKeyword, startDate, setStartDate, endDate, setEndDate, showAdvanced, setShowAdvanced, handleSearch, setIsBrainstormOpen, isDarkMode }) => (
  <div className="pb-3 flex flex-col w-full">
    <div className="flex flex-col sm:flex-row gap-3 sm:items-start justify-between w-full">
      <div className="flex flex-col w-full">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
          {['全部', '看板', '待辦', '行程', '好文', '檔案'].map(t => (
            <button key={t} onClick={() => { setFilter(t); setSubFilter('全部'); }} className={`px-4 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all ${filter === t ? 'bg-indigo-600 text-white shadow-md' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-400 border border-slate-200/60')}`}>{t}</button>
          ))}
          <button onClick={() => setIsBrainstormOpen(true)} className={`px-4 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow-md hover:scale-105`}>💡 幫我想想</button>
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
    <div className={`mt-3 px-3 py-2 rounded-lg text-[11px] font-bold tracking-wide ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
      💡 系統升級提示：透過 LINE 傳送「思考 [名詞/連結]」將強制開啟 AI 網路檢索；傳送「生成圖片 [關鍵字]」可啟動 AI 繪圖；傳送 YouTube 網址自動提取影片資訊。
    </div>
  </div>
);

// ─── InfoCard ─────────────────────────────────────────────────
const InfoCard = ({ item, isManageMode, selectedIds, toggleSelection, setEditingItem, setConfirmDelete, handleToggleTodo, handleToggleCompleted, isDarkMode }) => {
  const thumb = getThumbnail(item?.url);
  const isSelected = selectedIds.has(item?.id);
  const isCompleted = item?.title?.includes('[已完成]');
  const isGCal = String(item?.id).startsWith('gcal-');

  return (
    <div onClick={() => isManageMode && toggleSelection(item.id)} className={`virtual-card group rounded-2xl border shadow-sm transition-all overflow-hidden flex flex-col relative ${isManageMode ? 'cursor-pointer' : ''} ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} ${isSelected ? 'ring-2 ring-indigo-500' : ''} ${isCompleted ? 'opacity-50 grayscale-[50%]' : ''}`}>
      {!isManageMode && !isGCal && (
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem({...item}); }} className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs shadow active:scale-95 cursor-pointer">✏️</button>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({id: item.id, url: item.url}); }} className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow active:scale-95 cursor-pointer">✕</button>
        </div>
      )}
      {item?.type === 'file' && thumb && (
        <div onClick={(e) => { if (!isManageMode) handleOpenUrl(e, item.url); }} className="w-full h-32 overflow-hidden cursor-pointer">
          <LazyImage src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${item?.color || 'bg-slate-100 text-slate-600'} ${isDarkMode && item?.color?.includes('slate') ? 'bg-slate-700 text-slate-300' : ''}`}>
            {item?.icon} {item?.type?.toUpperCase()}
          </div>
          {item?.type === 'article' && getTags(item.subcategory).map(tag => (
             <span key={tag} className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">{tag}</span>
          ))}
          <span className="text-[10px] font-bold text-slate-400 ml-auto whitespace-nowrap">{item?.date} {item?.time}</span>
        </div>
        <h2 onClick={(e) => { if (!isManageMode && item?.type !== 'todo' && item?.url) handleOpenUrl(e, item.url); }} className={`text-base font-black leading-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} ${item?.type !== 'todo' && !isManageMode ? 'cursor-pointer hover:text-indigo-500' : ''}`}>
          {item?.title ?? '無標題'}
        </h2>
        {item?.type === 'todo' ? (
          <div className="space-y-2 mt-3">
            {(item?.content || '').split('\n').map((line, idx) => {
              const isChecked = line.includes('- [x]');
              const isTodo = line.includes('- [ ]') || isChecked;
              if (!isTodo) return <p key={idx} className="text-xs text-slate-500">{line}</p>;
              return (
                <div key={idx} className="flex items-start gap-2 cursor-pointer group/todo" onClick={(e) => { if (!isManageMode) handleToggleTodo(item.id, item.content, idx); e.stopPropagation(); }}>
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-400 group-hover/todo:border-indigo-400'}`}>
                    {isChecked && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`text-sm font-medium ${isChecked ? 'text-slate-500 line-through' : ''}`}>{line.replace(/- \[(x| )\] /, '')}</span>
                </div>
              );
            })}
            {!isManageMode && !isGCal && (
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={(e) => handleToggleCompleted(item, e)} className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isCompleted ? (isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-600') : (isDarkMode ? 'bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-400' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600')}`}>
                  {isCompleted ? '↺ 取消完成' : '✅ 標示為完成'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-3 text-xs font-medium leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item?.content ?? '') }} />
        )}

        {item?.type === 'event' && (
          <div className="mt-4 flex flex-col gap-2">
            {!isGCal && (
              <a href={item?.url && item.url !== '#' ? item.url : generateCalendarUrl(item?.title, item?.content)} target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isDarkMode ? 'bg-blue-900/50 hover:bg-blue-800/50 text-blue-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-600'}`}>📅 加入 Google 行事曆</a>
            )}
            {!isManageMode && (
              <button onClick={(e) => handleToggleCompleted(item, e)} className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isCompleted ? (isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-600') : (isDarkMode ? 'bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-400' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600')}`}>
                {isCompleted ? '↺ 取消完成' : '✅ 標示為完成'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── KanbanView ───────────────────────────────────────────────
const KanbanView = ({ items, renderCard, isDarkMode }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start w-full">
    <div className={`rounded-2xl p-4 min-h-[500px] border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <h2 className="font-black text-lg mb-4 text-amber-500 flex justify-between items-center">
        <span>🚀 待處理任務</span>
        <span className="text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded-lg">{items.filter(i => i.type === 'todo' && !i.title.includes('[已完成]')).length}</span>
      </h2>
      <div className="flex flex-col gap-4">
        {items.filter(i => i.type === 'todo' && !i.title.includes('[已完成]')).map(renderCard)}
      </div>
    </div>
    <div className={`rounded-2xl p-4 min-h-[500px] border ${isDarkMode ? 'bg-emerald-900/10 border-emerald-900/30' : 'bg-emerald-50 border-emerald-100'}`}>
      <h2 className="font-black text-lg mb-4 text-emerald-600 flex justify-between items-center">
        <span>✅ 已完成任務</span>
        <span className="text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 px-2 py-0.5 rounded-lg">{items.filter(i => i.type === 'todo' && i.title.includes('[已完成]')).length}</span>
      </h2>
      <div className="flex flex-col gap-4">
        {items.filter(i => i.type === 'todo' && i.title.includes('[已完成]')).map(renderCard)}
      </div>
    </div>
  </div>
);

// ─── Brainstorm Modal ─────────────────────────────────────────
const BrainstormModal = ({ isDarkMode, setIsBrainstormOpen, filteredContext, executeAction }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);

  const handleBrainstorm = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult(null);
    try {
      const res = await fetch(GAS_URL, {
        redirect: 'follow',
        method: 'POST',
        body: JSON.stringify({ action: 'brainstorm', query, context: filteredContext })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      } else {
        setResult({ title: '分析失敗', content: '後端發生未知錯誤。' });
      }
    } catch (e) {
      setResult({ title: '連線異常', content: '網路無法連線，請稍後再試。' });
    }
    setIsSearching(false);
  };

  const handleSaveToWall = () => {
    if (!result) return;
    const newId = crypto.randomUUID();
    executeAction('updateFull', {
      id: newId,
      type: 'article',
      subcategory: '深度思考',
      title: encodeURIComponent(result.title),
      content: encodeURIComponent(result.content),
      color: 'bg-indigo-50 text-indigo-700',
      icon: '💡'
    }, "已儲存至資訊牆！");
    setIsBrainstormOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className={`rounded-[2rem] p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black flex items-center gap-2">
            <span className="text-2xl">💡</span> AI 深度網路檢索與分析
          </h3>
          <button onClick={() => setIsBrainstormOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
          強制啟動 Google Search 穿透驗證，可輸入名詞或網址。系統將主動進行負面與法規檢索。
        </p>
        
        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()}
              placeholder="輸入欲深入查證的產品名稱或網址..." 
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold outline-none border focus:border-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} 
            />
            <button 
              onClick={handleBrainstorm} 
              disabled={isSearching || !query.trim()} 
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 rounded-xl text-sm font-black shadow-md disabled:opacity-50 hover:scale-105 transition-transform"
            >
              {isSearching ? '檢索中...' : '開始分析'}
            </button>
          </div>

          {isSearching && (
            <div className={`flex-1 rounded-2xl flex flex-col items-center justify-center p-8 border border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-300 bg-slate-50'}`}>
              <div className="text-4xl animate-bounce mb-2">🌐</div>
              <p className="text-sm font-bold text-indigo-500 animate-pulse">正在執行 Google Search 穿透驗證與法規比對...</p>
            </div>
          )}

          {result && !isSearching && (
            <div className={`flex-1 overflow-y-auto p-5 rounded-2xl border ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
              <h4 className="text-lg font-black mb-3 text-indigo-500">{result.title}</h4>
              <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.content) }} />
            </div>
          )}
        </div>

        {result && !isSearching && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            <button onClick={handleSaveToWall} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg hover:bg-indigo-500 transition-colors">
              📥 將報告儲存至資訊牆
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── App 主元件 ───────────────────────────────────────────────
export default function App() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('全部');
  const [subFilter, setSubFilter] = useState('全部');
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(null);
  
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [askAiQuery, setAskAiQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isAskAiLoading, setIsAskAiLoading] = useState(false);
  const chatScrollRef = useRef(null);
  
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagMergeSources, setTagMergeSources] = useState([]);
  const [tagMergeTarget, setTagMergeTarget] = useState('');
  
  const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
  
  const pendingTimers = useRef({});

  const showMessage = useCallback((msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); }, []);

  // PWA manifest
  useEffect(() => {
    const manifest = { name: "智能資訊牆", short_name: "資訊牆", start_url: ".", display: "standalone", background_color: "#0f172a", theme_color: "#4f46e5", icons: [{ src: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📋</text></svg>", sizes: "192x192", type: "image/svg+xml" }] };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const link = document.createElement('link');
    link.rel = 'manifest'; link.href = URL.createObjectURL(blob); document.head.appendChild(link);
    const handleBeforeInstallPrompt = (e) => { e.preventDefault(); setPwaPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const installPWA = async () => {
    if (!pwaPrompt) return;
    pwaPrompt.prompt();
    const { outcome } = await pwaPrompt.userChoice;
    if (outcome === 'accepted') setPwaPrompt(null);
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true); setIsError(false);
    try {
      const res = await fetch(GAS_URL + '?action=getData', { redirect: 'follow' });
      const data = await res.json();
      if (data && data.error) throw new Error(`後端回應: ${data.message}`);
      if (Array.isArray(data)) { setItems(data); await saveToIDB('infoWallCache', data); }
    } catch (e) { setIsError(true); showMessage(e.message || "網路讀取失敗"); }
    finally { setIsLoading(false); }
  }, [showMessage]);

  useEffect(() => {
    const init = async () => {
      const cached = await getFromIDB('infoWallCache');
      if (cached && Array.isArray(cached)) { setItems(cached); setIsLoading(false); }
      if (window.liff) {
        try {
          await window.liff.init({ liffId: LIFF_ID });
          if (window.liff.isLoggedIn()) setProfile(await window.liff.getProfile());
        } catch (e) {}
      }
      fetchData();
    };
    init();
  }, [fetchData]);

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedIds(newSet);
  };

  // ─── executeAction ──────────────────────────────
  const executeAction = async (action, idsOrItem, successMsg) => {
    setIsProcessing(true);
    try {
      let payload = { action };
      if (action === 'deleteBatch' || action === 'archiveBatch') payload.ids = encodeURIComponent(JSON.stringify(idsOrItem));
      else if (action === 'delete') { payload.id = idsOrItem.id; payload.url = encodeURIComponent(idsOrItem.url); }
      else Object.assign(payload, idsOrItem);

      if (action === 'delete' || action === 'deleteBatch' || action === 'archiveBatch') {
        const affectedIds = action === 'delete' ? [idsOrItem.id] : idsOrItem;
        const snapshot = items.filter(i => affectedIds.includes(i.id));

        setItems(prev => prev.filter(i => !affectedIds.includes(i.id)));
        if (action !== 'delete') { setSelectedIds(new Set()); setIsManageMode(false); }
        if (action === 'delete') setConfirmDelete(null);

        let undone = false;

        const timerId = setTimeout(async () => {
          if (undone) return;
          try {
            const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify(payload) });
            const result = await res.json();
            if (!result?.success) {
              setItems(prev => [...snapshot, ...prev]);
              showMessage('操作失敗，已自動還原');
            }
          } catch {
            setItems(prev => [...snapshot, ...prev]);
            showMessage('網路錯誤，已自動還原');
          }
        }, 5000);

        const entryId = Date.now();
        pendingTimers.current[entryId] = timerId;

        useUndoStore.push({
          id: entryId,
          label: successMsg,
          autoRemove: true,
          undo: () => {
            undone = true;
            clearTimeout(timerId);
            delete pendingTimers.current[entryId];
            setItems(prev => {
              const combined = [...snapshot, ...prev];
              const seen = new Set();
              return combined.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
            });
            showMessage('✅ 已撤銷');
          },
        });

        showMessage(`${successMsg}（5 秒內可撤銷）`);
        setIsProcessing(false);
        return;
      }

      // updateFull (包含 Brainstorm 新增) 維持原邏輯
      const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify(payload) });
      const result = await res.json();
      if (result?.success) {
        if (action === 'updateFull') {
          // 如果是已存在的 id 則更新，否則(如 Brainstorm 新增) 則插入前方
          setItems(prev => {
            const exists = prev.find(i => i.id === idsOrItem.id);
            if (exists) return prev.map(i => i.id === idsOrItem.id ? {...i, ...idsOrItem} : i);
            const newItem = {
                id: idsOrItem.id, type: idsOrItem.type, subcategory: decodeURIComponent(idsOrItem.subcategory),
                title: decodeURIComponent(idsOrItem.title), content: decodeURIComponent(idsOrItem.content),
                date: new Date().toLocaleDateString('en-CA'), time: new Date().toTimeString().substring(0,5),
                url: '#', icon: idsOrItem.icon || '📄', color: idsOrItem.color || 'bg-slate-50 text-slate-700'
            };
            return [newItem, ...prev];
          });
          setEditingItem(null);
        }
        showMessage(successMsg);
      } else showMessage('操作失敗');
    } catch (e) { showMessage('網路連線錯誤'); }
    setIsProcessing(false);
  };

  const handleToggleTodo = async (id, currentContent, lineIndex) => {
    const oldContent = currentContent;
    const lines = currentContent.split('\n');
    lines[lineIndex] = lines[lineIndex].includes('- [ ]')
      ? lines[lineIndex].replace('- [ ]', '- [x]')
      : lines[lineIndex].replace('- [x]', '- [ ]');
    const newContent = lines.join('\n');

    setItems(prev => prev.map(item => item.id === id ? { ...item, content: newContent } : item));

    useUndoStore.push({
      id: Date.now(),
      label: '待辦項目已更新',
      autoRemove: true,
      undo: () => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, content: oldContent } : item));
        fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'updateFull', id, content: encodeURIComponent(oldContent) }) });
        showMessage('✅ 已撤銷');
      },
    });

    fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'updateFull', id, content: encodeURIComponent(newContent) }) });
  };

  const handleToggleCompleted = async (item, e) => {
    e.preventDefault(); e.stopPropagation();
    const isCompleted = item?.title?.includes('[已完成]');
    const oldTitle = item.title;
    const oldContent = item.content;
    let newTitle = item.title || '無標題';
    let newContent = item.content;
    if (isCompleted) newTitle = newTitle.replace(/\[已完成\]\s*/g, '');
    else {
      newTitle = `[已完成] ${newTitle}`;
      if (item.type === 'todo' && newContent) newContent = newContent.replace(/- \[ \]/g, '- [x]');
    }

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: newTitle, content: item.type === 'todo' ? newContent : i.content } : i));

    useUndoStore.push({
      id: Date.now(),
      label: isCompleted ? '已取消完成' : '已標示完成',
      autoRemove: true,
      undo: () => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: oldTitle, content: oldContent } : i));
        fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({
          action: 'updateFull', id: item.id,
          title: encodeURIComponent(oldTitle), type: item.type,
          ...(item.type === 'todo' ? { content: encodeURIComponent(oldContent) } : {})
        }) });
        showMessage('✅ 已撤銷');
      },
    });

    fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({
      action: 'updateFull', id: item.id,
      title: encodeURIComponent(newTitle), type: item.type,
      ...(item.type === 'todo' ? { content: encodeURIComponent(newContent) } : {})
    }) });
  };

  const handleMergeTags = async () => {
    if (tagMergeSources.length === 0 || !tagMergeTarget || tagMergeSources.includes(tagMergeTarget)) return;
    setIsProcessing(true);
    try {
      const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'mergeTags', oldTags: tagMergeSources, newTag: tagMergeTarget }) });
      const result = await res.json();
      if (result?.success) {
        setItems(prev => prev.map(item => {
          if (item.type !== 'article' || !item.subcategory) return item;
          const tags = item.subcategory.split(/[,、]/).map(s => s.trim());
          let hasChanges = false;
          const newTags = tags.map(t => { if (tagMergeSources.includes(t)) { hasChanges = true; return tagMergeTarget; } return t; });
          return hasChanges ? { ...item, subcategory: [...new Set(newTags)].join(', ') } : item;
        }));
        showMessage(`已將 ${tagMergeSources.length} 個標籤合併為「${tagMergeTarget}」`);
        setIsTagManagerOpen(false); setTagMergeSources([]); setTagMergeTarget('');
      }
    } catch (e) { showMessage('網路連線錯誤'); }
    setIsProcessing(false);
  };

  const handleAskAI = async () => {
    if (!askAiQuery.trim()) return;
    const currentQuery = askAiQuery;
    setAskAiQuery(''); setIsAskAiLoading(true);
    const newHistory = [...chatHistory, { role: 'user', content: currentQuery }];
    setChatHistory(newHistory);
    try {
      const contextData = filteredAndSorted.map(i => `[${i.type}] ${i.title}: ${i.content}`).join('\n\n').substring(0, 8000);
      const historyText = newHistory.map(m => `${m.role === 'user' ? '用戶' : 'AI'}: ${m.content}`).join('\n');
      const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'askAI', question: currentQuery, context: contextData, history: historyText }) });
      const result = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', content: result.success ? result.answer : '發生錯誤，請稍後再試。' }]);
    } catch (e) { setChatHistory(prev => [...prev, { role: 'ai', content: '網路連線異常，無法聯繫知識庫。' }]); }
    setIsAskAiLoading(false);
  };

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatHistory, isAskAiLoading]);

  const filterMap = { '全部': 'all', '待辦': 'todo', '行程': 'event', '好文': 'article', '檔案': 'file' };

  const subcategories = useMemo(() => {
    if (!Array.isArray(items)) return ['全部'];
    const allTags = items.filter(i => i.type === 'article').flatMap(i => getTags(i.subcategory));
    return ['全部', ...new Set(allTags.length ? allTags : ['未分類'])];
  }, [items]);

  const filteredAndSorted = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const todayStr = new Date().toLocaleDateString('en-CA');
    let baseFiltered = items.filter(i => {
      if (filter === '看板') return true;
      const typeMatch = filter === '全部' ? true : i.type === filterMap[filter];
      const tags = getTags(i.subcategory);
      const subMatch = (filter === '好文' && subFilter !== '全部') ? (tags.includes(subFilter) || (tags.length === 0 && subFilter === '未分類')) : true;
      let dateMatch = true;
      if (startDate && i.date) dateMatch = dateMatch && (i.date >= startDate);
      if (endDate && i.date) dateMatch = dateMatch && (i.date <= endDate);
      return typeMatch && subMatch && dateMatch;
    });

    let upcomingEvents = baseFiltered.filter(i => i.type === 'event' && (i.date || '') >= todayStr);
    let others = baseFiltered.filter(i => !(i.type === 'event' && (i.date || '') >= todayStr));
    upcomingEvents.sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
    let result = [...upcomingEvents, ...others];

    if (keyword) {
      const kw = keyword.toLowerCase();
      result = result.map(i => {
        let score = 0;
        const t = (i.title || '').toLowerCase(), c = (i.content || '').toLowerCase();
        if (t === kw) score += 100; else if (t.includes(kw)) score += 50;
        if (c === kw) score += 20; else if (c.includes(kw)) score += 10;
        return { ...i, _score: score };
      }).filter(i => i._score > 0).sort((a, b) => b._score - a._score);
    }
    return result;
  }, [items, filter, subFilter, keyword, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const currentItems = filteredAndSorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [filter, subFilter, keyword, startDate, endDate]);

  const todoStats = useMemo(() => {
    let total = 0, completed = 0;
    filteredAndSorted.forEach(item => {
      if (item.type === 'todo') {
        (item.content || '').split('\n').forEach(line => {
          if (line.includes('- [ ]') || line.includes('- [x]')) {
            total++;
            if (line.includes('- [x]')) completed++;
          }
        });
      }
    });
    return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [filteredAndSorted]);

  const renderCardFn = (item) => (
    <InfoCard
      key={item.id}
      item={item}
      isManageMode={isManageMode}
      selectedIds={selectedIds}
      toggleSelection={toggleSelection}
      setEditingItem={setEditingItem}
      setConfirmDelete={setConfirmDelete}
      handleToggleTodo={handleToggleTodo}
      handleToggleCompleted={handleToggleCompleted}
      isDarkMode={isDarkMode}
    />
  );

  return (
    <div className={`w-full h-full min-h-screen flex flex-col font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <SystemHeader
        pwaPrompt={pwaPrompt} installPWA={installPWA}
        isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        isManageMode={isManageMode} setIsManageMode={setIsManageMode}
        selectedIds={selectedIds}
        handleBatchArchive={() => executeAction('archiveBatch', Array.from(selectedIds), `封存 ${selectedIds.size} 筆資料`)}
        handleBatchDelete={() => executeAction('deleteBatch', Array.from(selectedIds), `刪除 ${selectedIds.size} 筆資料`)}
        isProcessing={isProcessing}
        setIsTagManagerOpen={setIsTagManagerOpen}
        profile={profile} todoStats={todoStats} filter={filter}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 pb-24">
        <FilterPanel
          filter={filter} setFilter={setFilter}
          subcategories={subcategories} subFilter={subFilter} setSubFilter={setSubFilter}
          keyword={keyword} setKeyword={setKeyword}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
          handleSearch={(e) => { e.preventDefault(); setCurrentPage(1); }}
          setIsBrainstormOpen={setIsBrainstormOpen}
          isDarkMode={isDarkMode}
        />

        <div className="pt-4">
          {filter === '看板'
            ? <KanbanView items={filteredAndSorted} renderCard={renderCardFn} isDarkMode={isDarkMode} />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                {currentItems.map(renderCardFn)}
              </div>
            )
          }
        </div>

        {!isLoading && filter !== '看板' && totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 pb-8">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'} ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 shadow-sm border border-slate-200'}`}>上一頁</button>
            <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>第 {currentPage} / {totalPages} 頁</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'} ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 shadow-sm border border-slate-200'}`}>下一頁</button>
          </div>
        )}
        {isLoading && !isError && <div className="py-10 text-center text-indigo-400 font-bold animate-pulse text-sm">數據同步中...</div>}
      </main>

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
            <h3 className="text-lg font-black mb-2 flex-shrink-0">🏷️ 標籤管理與自動記憶</h3>
            <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed flex-shrink-0">將散亂的同義標籤合併，未來 AI 分類會優先引用標準庫。</p>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 no-scrollbar">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">點選原始標籤 (可多選)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {subcategories.filter(t => t !== '全部' && t !== '未分類').map(t => {
                    const isSel = tagMergeSources.includes(t);
                    return (
                      <button key={t} onClick={() => setTagMergeSources(p => isSel ? p.filter(tag => tag !== t) : [...p, t])} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSel ? 'bg-indigo-500 text-white shadow-md scale-105' : (isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>{t} {isSel && '✓'}</button>
                    );
                  })}
                </div>
                {tagMergeSources.length > 0 && (
                  <div className={`p-3 rounded-xl text-sm mb-4 ${isDarkMode ? 'bg-indigo-900/30 border border-indigo-700/50' : 'bg-indigo-50 border border-indigo-200'}`}>
                    <span className="text-xs font-bold text-indigo-500 block mb-2">已選候選區 ({tagMergeSources.length})：</span>
                    <div className="flex flex-wrap gap-1.5">{tagMergeSources.map(t => <span key={t} className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-xs font-bold">{t}</span>)}</div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">合併為標準標籤</label>
                <input type="text" list="standard-tags" value={tagMergeTarget} onChange={e => setTagMergeTarget(e.target.value)} placeholder="例如：人工智慧" className={`w-full p-3 rounded-xl text-sm font-bold outline-none border focus:border-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                <datalist id="standard-tags">{subcategories.filter(t => t !== '全部' && t !== '未分類').map(t => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => { setIsTagManagerOpen(false); setTagMergeSources([]); setTagMergeTarget(''); }} className={`flex-1 py-3 rounded-xl font-black text-sm ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>取消</button>
              <button onClick={handleMergeTags} disabled={isProcessing || tagMergeSources.length === 0 || !tagMergeTarget || tagMergeSources.includes(tagMergeTarget)} className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg disabled:opacity-50">合併</button>
            </div>
          </div>
        </div>
      )}

      {/* Brainstorm Modal */}
      {isBrainstormOpen && (
        <BrainstormModal 
          isDarkMode={isDarkMode} 
          setIsBrainstormOpen={setIsBrainstormOpen}
          filteredContext={filteredAndSorted.map(i => `[${i.type}] ${i.title}: ${i.content}`).join('\n\n').substring(0, 8000)}
          executeAction={executeAction}
        />
      )}

      {/* AI Chat */}
      <button onClick={() => setIsAskAiOpen(!isAskAiOpen)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform">✨</button>
      {isAskAiOpen && (
        <div className={`fixed bottom-24 right-6 z-[9999] w-[calc(100%-3rem)] sm:w-96 h-[500px] max-h-[70vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="p-4 bg-indigo-600 text-white font-black flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-2">
              <span>知識庫助理</span>
              <button onClick={() => setChatHistory([])} className="text-[10px] bg-white/20 hover:bg-white/40 px-2 py-1 rounded">清除記憶</button>
            </div>
            <button onClick={() => setIsAskAiOpen(false)} className="opacity-70 hover:opacity-100 text-lg">✕</button>
          </div>
          <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-sm ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`} ref={chatScrollRef}>
            <div className={`p-3 rounded-2xl rounded-tl-none self-start max-w-[90%] ${isDarkMode ? 'bg-indigo-900/30 text-indigo-200' : 'bg-indigo-100 text-indigo-800'}`}>您好！您可以針對目前過濾出的資料與我對話。</div>
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none self-end' : (isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none self-start' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none self-start')}`}>{msg.content}</div>
            ))}
            {isAskAiLoading && <div className="text-indigo-500 font-bold animate-pulse text-xs ml-2">分析中...</div>}
          </div>
          <div className={`p-3 border-t flex gap-2 z-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <input type="text" value={askAiQuery} onChange={(e) => setAskAiQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskAI()} placeholder="詢問..." className={`flex-1 px-3 py-2 rounded-xl text-sm outline-none border focus:border-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
            <button onClick={handleAskAI} disabled={isAskAiLoading || !askAiQuery.trim()} className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-bold disabled:opacity-50">送出</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-6 w-full max-w-md shadow-2xl ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
            <h3 className="text-lg font-black mb-4">編輯紀錄</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">分類</label>
                <select value={editingItem.type || 'article'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className={`w-full p-2 rounded-xl text-sm outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <option value="article">好文</option>
                  <option value="todo">待辦</option>
                  <option value="event">行程</option>
                  <option value="file">檔案</option>
                </select>
              </div>
              {editingItem.type === 'article' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">多重次分類</label>
                  <input type="text" value={editingItem.subcategory || ''} onChange={e => setEditingItem({...editingItem, subcategory: e.target.value})} className={`w-full p-2 rounded-xl text-sm outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {subcategories.filter(t => t !== '全部' && t !== '未分類').map(tag => {
                      const currentTags = (editingItem.subcategory || '').split(/[,、]/).map(t => t.trim()).filter(Boolean);
                      const isSel = currentTags.includes(tag);
                      return (
                        <button key={tag} onClick={() => setEditingItem({...editingItem, subcategory: (isSel ? currentTags.filter(t => t !== tag) : [...currentTags, tag]).join(', ')})} className={`px-2 py-1 rounded-md text-[10px] font-bold ${isSel ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}`}>{tag}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">標題</label>
                <input type="text" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className={`w-full p-2 rounded-xl text-sm outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">內容</label>
                <textarea rows={5} value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className={`w-full p-2 rounded-xl text-sm outline-none border resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingItem(null)} className={`flex-1 py-2.5 rounded-xl font-black text-sm ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>取消</button>
              <button
                onClick={() => {
                  const snapshot = items.find(i => i.id === editingItem.id);
                  if (snapshot) {
                    useUndoStore.push({
                      id: Date.now(),
                      label: '編輯已儲存',
                      autoRemove: true,
                      undo: () => {
                        setItems(prev => prev.map(i => i.id === snapshot.id ? snapshot : i));
                        fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({
                          action: 'updateFull', id: snapshot.id,
                          title: encodeURIComponent(snapshot.title || ''),
                          content: encodeURIComponent(snapshot.content || ''),
                          type: snapshot.type,
                          subcategory: encodeURIComponent(snapshot.subcategory || '')
                        }) });
                        showMessage('✅ 已撤銷');
                      },
                    });
                  }
                  executeAction('updateFull', {
                    id: editingItem.id,
                    title: encodeURIComponent(editingItem.title || ''),
                    content: encodeURIComponent(editingItem.content || ''),
                    type: editingItem.type,
                    subcategory: encodeURIComponent(editingItem.subcategory || '')
                  }, "更新成功");
                }}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg disabled:opacity-50"
              >
                儲存變更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-8 max-w-sm w-full shadow-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>確認刪除？</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">刪除後 5 秒內可從通知列撤銷。</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className={`flex-1 py-3 rounded-2xl font-black text-sm ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>取消</button>
              <button onClick={() => executeAction('delete', { id: confirmDelete.id, url: confirmDelete.url }, '刪除成功')} disabled={isProcessing} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-sm shadow-lg disabled:opacity-50">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      <UndoToast isDarkMode={isDarkMode} />

      {message && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] px-6 py-3 bg-slate-800 text-white rounded-full shadow-2xl text-sm font-black animate-fade-in border border-slate-700">{message}</div>
      )}
    </div>
  );
}