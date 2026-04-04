// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import './index.css';
import './App.css';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyPMIeiPEvlGa4o5fs2ea3sWqtISn4bVp2G7S3HV1t-acgFozmRZvCIDe5qXKc8nUBkHQ/exec';
const LIFF_ID = '2009406684-H9fk9ysT';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

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

const getThumbnail = (item) => {
  const url = item?.url;
  if (url && url.includes('drive.google.com')) {
    const match = url.match(/\/d\/(.+?)\//) || url.match(/id=(.+?)(&|$)/);
    return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400` : null;
  }
  const content = item?.content || '';
  if (content.includes('image.pollinations.ai')) {
    return content;
  }
  return null;
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
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold transition-all animate-fade-in ${isDarkMode ? 'bg-[#1e293b] border-[#334155] text-[#f8fafc]' : 'bg-white border-slate-200 text-slate-800'}`}>
      <span>{entry.label}</span>
      <button onClick={() => handleUndo(entry)} className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-500 transition-colors">↩ 撤銷</button>
      <button onClick={() => useUndoStore.pop()} className={`px-2 py-1 rounded-xl text-xs transition-colors ${isDarkMode ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
    </div>
  );
};

const SystemHeader = ({ pwaPrompt, installPWA, isDarkMode, setIsDarkMode, isManageMode, setIsManageMode, selectedIds, handleBatchArchive, handleBatchDelete, isProcessing, setIsTagManagerOpen, profile, todoStats, mainTab, setMainTab }) => (
  <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a]/90 border-[#334155]' : 'bg-white/80 border-slate-200/50'}`}>
    <div className="py-3 flex justify-between items-center flex-wrap gap-2 px-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">📋</div>
        <h1 className={`text-lg font-black tracking-tighter hidden sm:block ${isDarkMode ? 'text-[#ffffff]' : 'text-slate-900'}`}>知識中樞</h1>
      </div>
      
      <div className={`flex items-center gap-2 p-1 rounded-xl ${isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-200/50'}`}>
        <button onClick={() => setMainTab('info')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mainTab === 'info' ? (isDarkMode ? 'bg-[#334155] shadow-sm text-[#ffffff]' : 'bg-white shadow-sm text-indigo-600') : (isDarkMode ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-slate-500 hover:text-slate-700')}`}>資訊精華</button>
        <button onClick={() => setMainTab('tasks')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mainTab === 'tasks' ? (isDarkMode ? 'bg-[#334155] shadow-sm text-[#ffffff]' : 'bg-white shadow-sm text-indigo-600') : (isDarkMode ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-slate-500 hover:text-slate-700')}`}>任務總管</button>
        <button onClick={() => setMainTab('files')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mainTab === 'files' ? (isDarkMode ? 'bg-[#334155] shadow-sm text-[#ffffff]' : 'bg-white shadow-sm text-indigo-600') : (isDarkMode ? 'text-[#94a3b8] hover:text-[#f8fafc]' : 'text-slate-500 hover:text-slate-700')}`}>雲端檔案</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {pwaPrompt && <button onClick={installPWA} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-black transition-colors hover:bg-blue-600">📥 安裝桌面版</button>}
        <button onClick={() => setIsTagManagerOpen(true)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${isDarkMode ? 'bg-[#1e293b] text-[#f8fafc] hover:bg-[#334155]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>🏷️ 標籤管理</button>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'bg-[#1e293b] text-yellow-400 hover:bg-[#334155]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{isDarkMode ? '☀️' : '🌙'}</button>
        <button onClick={() => setIsManageMode(!isManageMode)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${isManageMode ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-[#1e293b] text-[#f8fafc] hover:bg-[#334155]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>批次管理</button>
        {profile && <img src={profile.pictureUrl} className="w-8 h-8 rounded-lg object-cover border border-slate-200" alt="" />}
      </div>
    </div>

    {mainTab === 'tasks' && todoStats.total > 0 && (
      <div className="pb-3 px-5 max-w-7xl mx-auto animate-fade-in">
        <div className="flex justify-between text-xs font-bold mb-1"><span className={`${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-400'}`}>任務達成率</span><span className="text-indigo-500">{todoStats.percent}% ({todoStats.completed}/{todoStats.total})</span></div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#334155]' : 'bg-slate-200'}`}><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${todoStats.percent}%` }}></div></div>
      </div>
    )}

    {isManageMode && (
      <div className={`py-2 border-t flex justify-between items-center px-4 max-w-7xl mx-auto ${isDarkMode ? 'border-[#334155] bg-[#1e293b]/50' : 'border-slate-200 bg-indigo-50/50'}`}>
        <span className="text-sm font-bold text-indigo-500">已選擇 {selectedIds.size} 筆</span>
        <div className="flex gap-2">
          <button onClick={handleBatchArchive} disabled={selectedIds.size === 0 || isProcessing} className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold disabled:opacity-50">封存選取</button>
          <button onClick={handleBatchDelete} disabled={selectedIds.size === 0 || isProcessing} className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold disabled:opacity-50">刪除選取</button>
        </div>
      </div>
    )}
  </header>
);

const UniversalSearch = ({ keyword, setKeyword, startDate, setStartDate, endDate, setEndDate, showAdvanced, setShowAdvanced, handleSearch, isDarkMode }) => (
  <div className="flex flex-col gap-2 w-full mb-4">
    <form onSubmit={handleSearch} className="flex gap-2 w-full">
      <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="全域搜尋關鍵字..." className={`px-4 py-2 rounded-xl text-sm font-bold focus:outline-none flex-1 transition-colors ${isDarkMode ? 'bg-[#1e293b] text-[#ffffff] border-[#334155] placeholder-[#94a3b8]' : 'bg-white text-slate-900 border-slate-200 shadow-sm placeholder-slate-400'}`} />
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showAdvanced ? (isDarkMode ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'bg-[#1e293b] text-[#cbd5e1]' : 'bg-slate-200 text-slate-700')}`}>進階</button>
      <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500">搜尋</button>
    </form>
    {showAdvanced && (
      <div className={`flex gap-3 p-3 rounded-xl text-xs w-full animate-fade-in ${isDarkMode ? 'bg-[#1e293b]' : 'bg-white shadow-sm'}`}>
        <div className="flex flex-col gap-1 flex-1">
          <label className={`text-[10px] font-bold ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>開始日期</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`px-3 py-2 rounded-lg outline-none font-bold border ${isDarkMode ? 'bg-[#0f172a] text-[#ffffff] border-[#334155]' : 'bg-slate-100 text-slate-800 border-transparent'}`} />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className={`text-[10px] font-bold ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>結束日期</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`px-3 py-2 rounded-lg outline-none font-bold border ${isDarkMode ? 'bg-[#0f172a] text-[#ffffff] border-[#334155]' : 'bg-slate-100 text-slate-800 border-transparent'}`} />
        </div>
      </div>
    )}
  </div>
);

const InfoCard = ({ item, isManageMode, selectedIds, toggleSelection, setEditingItem, setConfirmDelete, handleToggleTodo, handleToggleCompleted, isDarkMode }) => {
  const thumb = getThumbnail(item);
  const isSelected = selectedIds.has(item?.id);
  const isCompleted = item?.title?.includes('[已完成]');
  const isGCal = String(item?.id).startsWith('gcal-');

  const cardBg = isDarkMode ? 'bg-[#1e293b] border-[#334155] hover:border-[#475569]' : 'bg-white border-slate-200 hover:border-slate-300';
  const titleColor = isDarkMode ? 'text-[#ffffff]' : 'text-slate-900';
  const contentColor = isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-600';
  const timeColor = isDarkMode ? 'text-[#94a3b8]' : 'text-slate-400';

  return (
    <div onClick={() => isManageMode && toggleSelection(item.id)} className={`virtual-card group rounded-2xl border shadow-sm transition-all overflow-hidden flex flex-col relative ${isManageMode ? 'cursor-pointer' : ''} ${cardBg} ${isSelected ? 'ring-2 ring-indigo-500' : ''} ${isCompleted ? 'opacity-50 grayscale-[50%]' : ''}`}>
      {!isManageMode && !isGCal && (
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem({...item}); }} className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs shadow active:scale-95 cursor-pointer">✏️</button>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({id: item.id, url: item.url}); }} className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow active:scale-95 cursor-pointer">✕</button>
        </div>
      )}
      {item?.type === 'file' && thumb && (
        <div onClick={(e) => { if (!isManageMode) handleOpenUrl(e, item.url !== '#' ? item.url : thumb); }} className="w-full h-32 overflow-hidden cursor-pointer bg-slate-900">
          <LazyImage src={thumb} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className={`px-2 py-1 rounded text-[10px] font-black uppercase ${item?.color || 'bg-slate-100 text-slate-600'} ${isDarkMode && item?.color?.includes('slate') ? 'bg-[#334155] text-[#f8fafc]' : ''}`}>
            {item?.icon} {item?.type?.toUpperCase()}
          </div>
          {item?.type === 'article' && getTags(item.subcategory).map(tag => (
             <span key={tag} className={`px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{tag}</span>
          ))}
          <span className={`text-[10px] font-bold ml-auto whitespace-nowrap ${timeColor}`}>{item?.date} {item?.time}</span>
        </div>
        <h2 onClick={(e) => { if (!isManageMode && item?.type !== 'todo' && (item?.url !== '#' || thumb)) handleOpenUrl(e, item.url !== '#' ? item.url : thumb); }} className={`text-base font-black leading-tight mb-2 ${titleColor} ${item?.type !== 'todo' && !isManageMode ? 'cursor-pointer hover:text-indigo-500' : ''}`}>
          {item?.title ?? '無標題'}
        </h2>
        {item?.type === 'todo' ? (
          <div className="space-y-2 mt-3">
            {(item?.content || '').split('\n').map((line, idx) => {
              const isChecked = line.includes('- [x]');
              const isTodo = line.includes('- [ ]') || isChecked;
              if (!isTodo) return <p key={idx} className={`text-xs ${contentColor}`}>{line}</p>;
              return (
                <div key={idx} className="flex items-start gap-2 cursor-pointer group/todo" onClick={(e) => { if (!isManageMode) handleToggleTodo(item.id, item.content, idx); e.stopPropagation(); }}>
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : (isDarkMode ? 'border-[#64748b] group-hover/todo:border-indigo-400' : 'border-slate-400 group-hover/todo:border-indigo-400')}`}>
                    {isChecked && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className={`text-sm font-medium ${isChecked ? (isDarkMode ? 'text-[#64748b] line-through' : 'text-slate-400 line-through') : titleColor}`}>{line.replace(/- \[(x| )\] /, '')}</span>
                </div>
              );
            })}
            {!isManageMode && !isGCal && (
              <div className="mt-4 flex flex-col gap-2">
                <button onClick={(e) => handleToggleCompleted(item, e)} className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isCompleted ? (isDarkMode ? 'bg-[#334155] text-[#cbd5e1] hover:bg-[#475569]' : 'bg-slate-200 text-slate-600 hover:bg-slate-300') : (isDarkMode ? 'bg-emerald-900/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100')}`}>
                  {isCompleted ? '↺ 取消完成' : '✅ 標示為完成'}
                </button>
              </div>
            )}
          </div>
        ) : (
          (!item?.content?.includes('image.pollinations.ai')) && <div className={`rounded-xl p-3 text-xs font-medium leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap ${isDarkMode ? 'bg-[#0f172a]/50 text-[#cbd5e1]' : 'bg-slate-50 text-slate-600'}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item?.content ?? '') }} />
        )}

        {item?.type === 'event' && (
          <div className="mt-4 flex flex-col gap-2">
            {!isGCal && (
              <a href={item?.url && item.url !== '#' ? item.url : generateCalendarUrl(item?.title, item?.content)} target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isDarkMode ? 'bg-blue-900/40 border border-blue-800 text-blue-400 hover:bg-blue-800' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>📅 加入 Google 行事曆</a>
            )}
            {!isManageMode && (
              <button onClick={(e) => handleToggleCompleted(item, e)} className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-colors ${isCompleted ? (isDarkMode ? 'bg-[#334155] text-[#cbd5e1] hover:bg-[#475569]' : 'bg-slate-200 text-slate-600 hover:bg-slate-300') : (isDarkMode ? 'bg-emerald-900/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100')}`}>
                {isCompleted ? '↺ 取消完成' : '✅ 標示為完成'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const HelpModal = ({
  isDarkMode, setShowHelp,
  query, setQuery, isSearching, result, handleBrainstorm, handleSaveToWall,
  askAiQuery, setAskAiQuery, isAskAiLoading, chatHistory, handleAskAI, chatScrollRef, setChatHistory,
  imageQuery, setImageQuery, isGeneratingImage, generatedImage, handleGenerateImage, handleSaveImageToWall
}) => {
  const [tab, setTab] = useState('brainstorm');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className={`rounded-[2rem] p-6 w-full max-w-lg shadow-2xl flex flex-col h-[600px] max-h-[90vh] ${isDarkMode ? 'bg-[#1e293b] text-[#ffffff]' : 'bg-white text-slate-800'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black flex items-center gap-2"><span>✨</span> 幫幫忙</h3>
          <button onClick={() => setShowHelp(false)} className={`text-xl font-bold ${isDarkMode ? 'text-[#94a3b8] hover:text-[#ffffff]' : 'text-slate-400 hover:text-slate-600'}`}>✕</button>
        </div>

        <div className={`flex gap-1 p-1 rounded-xl mb-4 flex-shrink-0 ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-100'}`}>
          <button onClick={() => setTab('brainstorm')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'brainstorm' ? (isDarkMode ? 'bg-[#334155] shadow text-indigo-300' : 'bg-white shadow text-indigo-600') : 'text-slate-500'}`}>深度檢索</button>
          <button onClick={() => setTab('chat')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'chat' ? (isDarkMode ? 'bg-[#334155] shadow text-emerald-300' : 'bg-white shadow text-emerald-600') : 'text-slate-500'}`}>知識庫對話</button>
          <button onClick={() => setTab('image')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'image' ? (isDarkMode ? 'bg-[#334155] shadow text-pink-300' : 'bg-white shadow text-pink-600') : 'text-slate-500'}`}>AI 繪圖</button>
        </div>

        {tab === 'brainstorm' && (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <p className={`text-xs font-medium ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>強制啟動網路搜尋驗證，可輸入名詞或網址，系統將進行法規與事實比對。</p>
            <div className="flex gap-2 flex-shrink-0">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBrainstorm()} placeholder="輸入查證主題..." className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold outline-none border focus:border-indigo-500 ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
              <button onClick={handleBrainstorm} disabled={isSearching || !query.trim()} className="bg-indigo-600 text-white px-5 rounded-xl text-sm font-black disabled:opacity-50 hover:bg-indigo-500">{isSearching ? '處理中' : '思考'}</button>
            </div>
            {isSearching && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-indigo-500">
                <div className="text-4xl animate-bounce mb-2">🌐</div>
                <p className="text-sm font-bold animate-pulse">執行網路穿透與資料庫比對...</p>
              </div>
            )}
            {result && !isSearching && (
              <div className={`flex-1 overflow-y-auto p-4 rounded-xl border mt-2 ${isDarkMode ? 'border-[#334155] bg-[#0f172a] text-[#cbd5e1]' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                <h4 className="text-base font-black mb-2 text-indigo-500">{result.title}</h4>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.content) }} />
              </div>
            )}
            {result && !isSearching && (
              <button onClick={handleSaveToWall} className="py-3 rounded-xl bg-indigo-600 text-white font-black text-sm mt-2 flex-shrink-0 hover:bg-indigo-500">📥 儲存報告至資訊牆</button>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className={`flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-sm rounded-xl mb-3 border ${isDarkMode ? 'bg-[#0f172a] border-[#334155]' : 'bg-slate-50 border-slate-200'}`} ref={chatScrollRef}>
              <div className={`p-3 rounded-2xl rounded-tl-none self-start max-w-[90%] font-medium ${isDarkMode ? 'bg-indigo-900/50 text-indigo-200 border border-indigo-800/50' : 'bg-indigo-100 text-indigo-800'}`}>您可以針對目前畫面上過濾出的資料詢問我。</div>
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-2xl max-w-[90%] font-medium whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none self-end' : (isDarkMode ? 'bg-[#1e293b] border border-[#334155] text-[#cbd5e1] rounded-tl-none self-start' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none self-start')}`}>{msg.content}</div>
              ))}
              {isAskAiLoading && <div className="text-indigo-500 font-bold animate-pulse text-xs ml-2">分析中...</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <input type="text" value={askAiQuery} onChange={(e) => setAskAiQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskAI()} placeholder="提問..." className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold outline-none border focus:border-emerald-500 ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
              <button onClick={handleAskAI} disabled={isAskAiLoading || !askAiQuery.trim()} className="bg-emerald-600 text-white px-5 rounded-xl text-sm font-black disabled:opacity-50 hover:bg-emerald-500">送出</button>
              <button onClick={() => setChatHistory([])} className={`px-3 rounded-xl text-xs font-bold transition-colors ${isDarkMode ? 'bg-[#334155] text-[#cbd5e1] hover:bg-[#475569]' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>清除</button>
            </div>
          </div>
        )}

        {tab === 'image' && (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <p className={`text-xs font-medium ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>輸入描述關鍵字，系統將即時為您生成專屬 AI 圖像。</p>
            <div className="flex gap-2 flex-shrink-0">
              <input type="text" value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerateImage()} placeholder="例如：一隻在太空喝咖啡的貓..." className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold outline-none border focus:border-pink-500 ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
              <button onClick={handleGenerateImage} disabled={isGeneratingImage || !imageQuery.trim()} className="bg-pink-600 text-white px-5 rounded-xl text-sm font-black disabled:opacity-50 hover:bg-pink-500">{isGeneratingImage ? '生成中' : '生成'}</button>
            </div>
            {isGeneratingImage && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-pink-500">
                <div className="text-4xl animate-spin mb-2">⏳</div>
                <p className="text-sm font-bold animate-pulse">AI 畫家中，請稍候...</p>
              </div>
            )}
            {generatedImage && !isGeneratingImage && (
              <div className={`flex-1 overflow-y-auto p-4 rounded-xl border mt-2 flex flex-col items-center justify-center ${isDarkMode ? 'border-[#334155] bg-[#0f172a]' : 'border-slate-200 bg-slate-50'}`}>
                <img src={generatedImage} alt="Generated AI" className="max-h-full rounded-lg shadow-md object-contain" />
              </div>
            )}
            {generatedImage && !isGeneratingImage && (
              <button onClick={handleSaveImageToWall} className="py-3 rounded-xl bg-pink-600 text-white font-black text-sm mt-2 flex-shrink-0 hover:bg-pink-500">📥 儲存圖片至雲端檔案</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [items, setItems] = useState([]);
  const [mainTab, setMainTab] = useState('tasks');
  const [subTab, setSubTab] = useState('todo');
  const [subFilter, setSubFilter] = useState('全部');
  const [hideCompleted, setHideCompleted] = useState(false);
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
  
  const [showHelp, setShowHelp] = useState(false);
  const [askAiQuery, setAskAiQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isAskAiLoading, setIsAskAiLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  
  const [imageQuery, setImageQuery] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagMergeSources, setTagMergeSources] = useState([]);
  const [tagMergeTarget, setTagMergeTarget] = useState('');
  
  const pendingTimers = useRef({});

  const showMessage = useCallback((msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); }, []);

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
            if (!result?.success) { setItems(prev => [...snapshot, ...prev]); showMessage('操作失敗，已自動還原'); }
          } catch { setItems(prev => [...snapshot, ...prev]); showMessage('網路錯誤，已自動還原'); }
        }, 5000);

        const entryId = Date.now();
        pendingTimers.current[entryId] = timerId;

        useUndoStore.push({
          id: entryId, label: successMsg, autoRemove: true,
          undo: () => {
            undone = true; clearTimeout(timerId); delete pendingTimers.current[entryId];
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

      const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify(payload) });
      const result = await res.json();
      if (result?.success) {
        if (action === 'updateFull') {
          setItems(prev => {
            const exists = prev.find(i => i.id === idsOrItem.id);
            if (exists) return prev.map(i => i.id === idsOrItem.id ? {...i, ...idsOrItem} : i);
            const newItem = {
                id: idsOrItem.id, type: idsOrItem.type, subcategory: decodeURIComponent(idsOrItem.subcategory),
                title: decodeURIComponent(idsOrItem.title), content: decodeURIComponent(idsOrItem.content),
                date: new Date().toLocaleDateString('en-CA'), time: new Date().toTimeString().substring(0,5),
                url: idsOrItem.url || '#', icon: idsOrItem.icon || '📄', color: idsOrItem.color || 'bg-slate-50 text-slate-700'
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
    lines[lineIndex] = lines[lineIndex].includes('- [ ]') ? lines[lineIndex].replace('- [ ]', '- [x]') : lines[lineIndex].replace('- [x]', '- [ ]');
    const newContent = lines.join('\n');
    setItems(prev => prev.map(item => item.id === id ? { ...item, content: newContent } : item));
    useUndoStore.push({
      id: Date.now(), label: '待辦項目已更新', autoRemove: true,
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
      id: Date.now(), label: isCompleted ? '已取消完成' : '已標示完成', autoRemove: true,
      undo: () => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, title: oldTitle, content: oldContent } : i));
        fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'updateFull', id: item.id, title: encodeURIComponent(oldTitle), type: item.type, ...(item.type === 'todo' ? { content: encodeURIComponent(oldContent) } : {}) }) });
        showMessage('✅ 已撤銷');
      },
    });
    fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'updateFull', id: item.id, title: encodeURIComponent(newTitle), type: item.type, ...(item.type === 'todo' ? { content: encodeURIComponent(newContent) } : {}) }) });
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

  const handleBrainstorm = async () => {
    if (!query.trim()) return;
    setIsSearching(true); setResult(null);
    try {
      const contextData = filteredAndSorted.map(i => `[${i.type}] ${i.title}: ${i.content}`).join('\n\n').substring(0, 8000);
      const res = await fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'brainstorm', query, context: contextData }) });
      const data = await res.json();
      if (data.success) setResult(data.result);
      else setResult({ title: '分析失敗', content: '後端發生未知錯誤。' });
    } catch (e) { setResult({ title: '連線異常', content: '網路無法連線，請稍後再試。' }); }
    setIsSearching(false);
  };

  const handleSaveToWall = () => {
    if (!result) return;
    const newId = generateId();
    executeAction('updateFull', {
      id: newId, type: 'article', subcategory: encodeURIComponent('深度思考'),
      title: encodeURIComponent(result.title), content: encodeURIComponent(result.content),
      color: 'bg-indigo-50 text-indigo-700', icon: '💡'
    }, "已儲存至資訊牆！");
    setShowHelp(false);
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

  const handleGenerateImage = () => {
    if (!imageQuery.trim()) return;
    setIsGeneratingImage(true);
    setGeneratedImage(null);
    const seed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imageQuery)}?nologo=true&seed=${seed}`;
    const img = new Image();
    img.onload = () => {
      setGeneratedImage(url);
      setIsGeneratingImage(false);
    };
    img.onerror = () => {
      setIsGeneratingImage(false);
      showMessage('圖片生成失敗，請稍後再試。');
    };
    img.src = url;
  };

  const handleSaveImageToWall = () => {
    if (!generatedImage) return;
    const newId = generateId();
    executeAction('updateFull', {
      id: newId, type: 'file', subcategory: encodeURIComponent('AI繪圖'),
      title: encodeURIComponent(imageQuery), content: encodeURIComponent(generatedImage),
      color: 'bg-pink-50 text-pink-700', icon: '🎨'
    }, "圖片已儲存至雲端檔案！");
    setShowHelp(false);
  };

  const subcategories = useMemo(() => {
    if (!Array.isArray(items)) return ['全部'];
    const allTags = items.filter(i => i.type === 'article').flatMap(i => getTags(i.subcategory));
    return ['全部', ...new Set(allTags.length ? allTags : ['未分類'])];
  }, [items]);

  const filteredAndSorted = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const todayStr = new Date().toLocaleDateString('en-CA');
    let baseFiltered = items.filter(i => {
      if (mainTab === 'tasks') {
        if (i.type !== 'todo' && i.type !== 'event') return false;
        if (i.type !== subTab) return false;
        if (hideCompleted && (i.title || '').includes('[已完成]')) return false;
      } else if (mainTab === 'info') {
        if (i.type !== 'article') return false;
      } else if (mainTab === 'files') {
        if (i.type !== 'file') return false;
      }
      
      const tags = getTags(i.subcategory);
      const subMatch = (mainTab === 'info' && subFilter !== '全部') 
        ? (tags.includes(subFilter) || (tags.length === 0 && subFilter === '未分類')) : true;
        
      let dateMatch = true;
      if (startDate && i.date) dateMatch = dateMatch && (i.date >= startDate);
      if (endDate && i.date) dateMatch = dateMatch && (i.date <= endDate);
      return subMatch && dateMatch;
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
  }, [items, mainTab, subTab, subFilter, keyword, startDate, endDate, hideCompleted]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE));
  const currentItems = filteredAndSorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [mainTab, subTab, subFilter, keyword, startDate, endDate, hideCompleted]);

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
      key={item.id} item={item} isManageMode={isManageMode} selectedIds={selectedIds}
      toggleSelection={toggleSelection} setEditingItem={setEditingItem} setConfirmDelete={setConfirmDelete}
      handleToggleTodo={handleToggleTodo} handleToggleCompleted={handleToggleCompleted} isDarkMode={isDarkMode}
    />
  );

  return (
    <div className={`w-full h-full min-h-screen flex flex-col font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0f172a] text-[#f8fafc]' : 'bg-slate-50 text-slate-900'}`}>
      <SystemHeader
        pwaPrompt={pwaPrompt} installPWA={installPWA}
        isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        isManageMode={isManageMode} setIsManageMode={setIsManageMode}
        selectedIds={selectedIds}
        handleBatchArchive={() => executeAction('archiveBatch', Array.from(selectedIds), `封存 ${selectedIds.size} 筆資料`)}
        handleBatchDelete={() => executeAction('deleteBatch', Array.from(selectedIds), `刪除 ${selectedIds.size} 筆資料`)}
        isProcessing={isProcessing} setIsTagManagerOpen={setIsTagManagerOpen}
        profile={profile} todoStats={todoStats} mainTab={mainTab} setMainTab={setMainTab}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 pb-24">
        <UniversalSearch 
          keyword={keyword} setKeyword={setKeyword}
          startDate={startDate} setStartDate={setStartDate}
          endDate={endDate} setEndDate={setEndDate}
          showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
          handleSearch={(e) => { e.preventDefault(); setCurrentPage(1); }}
          isDarkMode={isDarkMode}
        />

        {mainTab === 'tasks' && (
          <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className={`flex gap-2 p-1 rounded-xl w-full sm:w-auto ${isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-200/50'}`}>
              <button onClick={() => setSubTab('todo')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${subTab === 'todo' ? 'bg-indigo-500 text-white shadow' : (isDarkMode ? 'text-[#94a3b8] hover:bg-[#334155]' : 'text-slate-600 hover:bg-slate-300/50')}`}>待辦事項</button>
              <button onClick={() => setSubTab('event')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${subTab === 'event' ? 'bg-indigo-500 text-white shadow' : (isDarkMode ? 'text-[#94a3b8] hover:bg-[#334155]' : 'text-slate-600 hover:bg-slate-300/50')}`}>行程規劃</button>
            </div>
            <label className={`flex items-center gap-2 cursor-pointer text-sm px-4 py-1.5 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-[#1e293b] text-[#cbd5e1] hover:bg-[#334155]' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/70'}`}>
              <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} className="accent-indigo-500 w-4 h-4" />
              隱藏已完成
            </label>
          </div>
        )}

        {mainTab === 'info' && subcategories.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {subcategories.map(sub => (
              <button key={sub} onClick={() => setSubFilter(sub)} className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${subFilter === sub ? 'bg-indigo-500 text-white shadow' : (isDarkMode ? 'bg-[#1e293b] text-[#cbd5e1] hover:bg-[#334155]' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}`}>{sub}</button>
            ))}
          </div>
        )}

        <div className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {currentItems.map(renderCardFn)}
            {!isLoading && currentItems.length === 0 && <p className={`col-span-full text-center py-10 font-bold ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>目前無符合條件的資料</p>}
          </div>
        </div>

        {!isLoading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 pb-8">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'} ${isDarkMode ? 'bg-[#1e293b] text-[#cbd5e1] hover:bg-[#334155]' : 'bg-white text-slate-600 shadow-sm border border-slate-200'}`}>上一頁</button>
            <span className={`text-sm font-bold ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>第 {currentPage} / {totalPages} 頁</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:text-white'} ${isDarkMode ? 'bg-[#1e293b] text-[#cbd5e1] hover:bg-[#334155]' : 'bg-white text-slate-600 shadow-sm border border-slate-200'}`}>下一頁</button>
          </div>
        )}
        {isLoading && !isError && <div className="py-10 text-center text-indigo-500 font-bold animate-pulse text-sm">數據同步中...</div>}
      </main>

      <button onClick={() => setShowHelp(true)} className="fixed bottom-6 right-6 bg-gradient-to-r from-amber-500 to-pink-500 text-white px-5 py-3 rounded-full shadow-lg flex items-center justify-center font-black text-sm hover:scale-105 transition-transform z-40">
        💡 幫幫忙
      </button>

      {showHelp && (
        <HelpModal 
          isDarkMode={isDarkMode} setShowHelp={setShowHelp}
          query={query} setQuery={setQuery} isSearching={isSearching} result={result} handleBrainstorm={handleBrainstorm} handleSaveToWall={handleSaveToWall}
          askAiQuery={askAiQuery} setAskAiQuery={setAskAiQuery} isAskAiLoading={isAskAiLoading} chatHistory={chatHistory} setChatHistory={setChatHistory} handleAskAI={handleAskAI} chatScrollRef={chatScrollRef}
          imageQuery={imageQuery} setImageQuery={setImageQuery} isGeneratingImage={isGeneratingImage} generatedImage={generatedImage} handleGenerateImage={handleGenerateImage} handleSaveImageToWall={handleSaveImageToWall}
        />
      )}

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#1e293b] text-[#ffffff]' : 'bg-white text-slate-800'}`}>
            <h3 className="text-lg font-black mb-2 flex-shrink-0">🏷️ 標籤管理與自動記憶</h3>
            <p className={`text-xs mb-4 font-medium leading-relaxed flex-shrink-0 ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>將散亂的同義標籤合併，未來 AI 分類會優先引用標準庫。</p>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 no-scrollbar">
              <div>
                <label className={`text-xs font-bold mb-2 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>點選原始標籤 (可多選)</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {subcategories.filter(t => t !== '全部' && t !== '未分類').map(t => {
                    const isSel = tagMergeSources.includes(t);
                    return (
                      <button key={t} onClick={() => setTagMergeSources(p => isSel ? p.filter(tag => tag !== t) : [...p, t])} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSel ? 'bg-indigo-500 text-white shadow-md scale-105' : (isDarkMode ? 'bg-[#334155] text-[#cbd5e1] hover:bg-[#475569]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>{t} {isSel && '✓'}</button>
                    );
                  })}
                </div>
                {tagMergeSources.length > 0 && (
                  <div className={`p-3 rounded-xl text-sm mb-4 ${isDarkMode ? 'bg-[#0f172a] border border-[#334155]' : 'bg-indigo-50 border border-indigo-200'}`}>
                    <span className="text-xs font-bold text-indigo-500 block mb-2">已選候選區 ({tagMergeSources.length})：</span>
                    <div className="flex flex-wrap gap-1.5">{tagMergeSources.map(t => <span key={t} className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-xs font-bold">{t}</span>)}</div>
                  </div>
                )}
              </div>
              <div>
                <label className={`text-xs font-bold mb-1 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>合併為標準標籤</label>
                <input type="text" list="standard-tags" value={tagMergeTarget} onChange={e => setTagMergeTarget(e.target.value)} placeholder="例如：人工智慧" className={`w-full p-3 rounded-xl text-sm font-bold outline-none border focus:border-indigo-500 ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff] placeholder-[#94a3b8]' : 'bg-slate-50 border-slate-200'}`} />
                <datalist id="standard-tags">{subcategories.filter(t => t !== '全部' && t !== '未分類').map(t => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-[#334155]">
              <button onClick={() => { setIsTagManagerOpen(false); setTagMergeSources([]); setTagMergeTarget(''); }} className={`flex-1 py-3 rounded-xl font-black text-sm transition-colors ${isDarkMode ? 'bg-[#334155] text-[#cbd5e1] hover:bg-[#475569]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>取消</button>
              <button onClick={handleMergeTags} disabled={isProcessing || tagMergeSources.length === 0 || !tagMergeTarget || tagMergeSources.includes(tagMergeTarget)} className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors">合併</button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-6 w-full max-w-md shadow-2xl ${isDarkMode ? 'bg-[#1e293b] text-[#ffffff]' : 'bg-white text-slate-800'}`}>
            <h3 className="text-lg font-black mb-4">編輯紀錄</h3>
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-bold mb-1 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>分類</label>
                <select value={editingItem.type || 'article'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className={`w-full p-2 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`}>
                  <option value="article">好文</option>
                  <option value="todo">待辦</option>
                  <option value="event">行程</option>
                  <option value="file">檔案</option>
                </select>
              </div>
              {editingItem.type === 'article' && (
                <div>
                  <label className={`text-xs font-bold mb-1 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>多重次分類</label>
                  <input type="text" value={editingItem.subcategory || ''} onChange={e => setEditingItem({...editingItem, subcategory: e.target.value})} className={`w-full p-2 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {subcategories.filter(t => t !== '全部' && t !== '未分類').map(tag => {
                      const currentTags = (editingItem.subcategory || '').split(/[,、]/).map(t => t.trim()).filter(Boolean);
                      const isSel = currentTags.includes(tag);
                      return (
                        <button key={tag} onClick={() => setEditingItem({...editingItem, subcategory: (isSel ? currentTags.filter(t => t !== tag) : [...currentTags, tag]).join(', ')})} className={`px-2 py-1 rounded-md text-[10px] font-bold ${isSel ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-[#334155] text-[#cbd5e1]' : 'bg-slate-200 text-slate-600')}`}>{tag}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className={`text-xs font-bold mb-1 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>標題</label>
                <input type="text" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className={`w-full p-2 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
              </div>
              <div>
                <label className={`text-xs font-bold mb-1 block ${isDarkMode ? 'text-[#cbd5e1]' : 'text-slate-500'}`}>內容</label>
                <textarea rows={5} value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className={`w-full p-2 rounded-xl text-sm font-bold outline-none border resize-none ${isDarkMode ? 'bg-[#0f172a] border-[#334155] text-[#ffffff]' : 'bg-slate-50 border-slate-200'}`} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingItem(null)} className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-colors ${isDarkMode ? 'bg-[#334155] hover:bg-[#475569]' : 'bg-slate-100 hover:bg-slate-200'}`}>取消</button>
              <button
                onClick={() => {
                  const snapshot = items.find(i => i.id === editingItem.id);
                  if (snapshot) {
                    useUndoStore.push({
                      id: Date.now(), label: '編輯已儲存', autoRemove: true,
                      undo: () => {
                        setItems(prev => prev.map(i => i.id === snapshot.id ? snapshot : i));
                        fetch(GAS_URL, { redirect: 'follow', method: 'POST', body: JSON.stringify({ action: 'updateFull', id: snapshot.id, title: encodeURIComponent(snapshot.title || ''), content: encodeURIComponent(snapshot.content || ''), type: snapshot.type, subcategory: encodeURIComponent(snapshot.subcategory || '') }) });
                        showMessage('✅ 已撤銷');
                      },
                    });
                  }
                  executeAction('updateFull', {
                    id: editingItem.id, title: encodeURIComponent(editingItem.title || ''), content: encodeURIComponent(editingItem.content || ''), type: editingItem.type, subcategory: encodeURIComponent(editingItem.subcategory || '')
                  }, "更新成功");
                }}
                disabled={isProcessing} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                儲存變更
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
          <div className={`rounded-[2rem] p-8 max-w-sm w-full shadow-2xl ${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-[#ffffff]' : 'text-slate-800'}`}>確認刪除？</h3>
            <p className={`text-sm font-medium mb-8 ${isDarkMode ? 'text-[#94a3b8]' : 'text-slate-500'}`}>刪除後 5 秒內可從通知列撤銷。</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className={`flex-1 py-3 rounded-2xl font-black text-sm transition-colors ${isDarkMode ? 'bg-[#334155] text-[#ffffff] hover:bg-[#475569]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>取消</button>
              <button onClick={() => executeAction('delete', { id: confirmDelete.id, url: confirmDelete.url }, '刪除成功')} disabled={isProcessing} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black text-sm shadow-lg hover:bg-red-500 disabled:opacity-50 transition-colors">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      <UndoToast isDarkMode={isDarkMode} />

      {message && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-2xl text-sm font-black animate-fade-in border ${isDarkMode ? 'bg-[#0f172a] text-[#ffffff] border-[#334155]' : 'bg-slate-800 text-white border-slate-700'}`}>{message}</div>
      )}
    </div>
  );
}