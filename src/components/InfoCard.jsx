import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import liff from '@line/liff';

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
  if (liff.isInClient()) liff.openWindow({ url: url, external: false });
  else window.open(url, '_blank');
};

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

export default function InfoCard({ item, isManageMode, selectedIds, toggleSelection, setEditingItem, setConfirmDelete, handleToggleTodo, handleToggleCompleted, isDarkMode }) {
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
}