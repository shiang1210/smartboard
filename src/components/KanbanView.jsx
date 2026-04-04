import React from 'react';

export default function KanbanView({ items, renderCard, isDarkMode }) {
  return (
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
}