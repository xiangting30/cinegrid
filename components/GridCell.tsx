import React, { useState, useRef } from 'react';
import { Trash2, Sparkles, Upload, MoreHorizontal, GripVertical, Copy, Check, Scan, Maximize, StretchHorizontal } from 'lucide-react';
import { GridItem, ShotPreset, StyleSettings } from '../types';
import { SHOT_PRESETS } from '../constants';
import { analyzeShotType } from '../services/geminiService';
import { Button } from './Button';

interface GridCellProps {
  item: GridItem;
  styleSettings: StyleSettings;
  onUpdate: (id: string, updates: Partial<GridItem>) => void;
  onRemove: (id: string) => void;
  onImageUpload: (file: File) => void;
  
  // Drag and Drop props
  onDragStart: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  draggable: boolean;
}

export const GridCell: React.FC<GridCellProps> = ({ 
  item, 
  styleSettings,
  onUpdate, 
  onRemove, 
  onImageUpload,
  onDragStart,
  onDragEnter,
  onDragEnd,
  draggable
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Bottom-Right Corner Resize Handler (Handles both Width & Height)
  const handleMouseDownResizeCorner = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    
    const cellElement = cellRef.current;
    if (!cellElement) return;

    // cellElement is the inner content div.
    // DOM Structure in App.tsx:
    // Container > Wrapper (with padding) > AspectRatioDiv > GridCell (cellElement)
    
    const startRect = cellElement.getBoundingClientRect();
    const startContentWidthPx = startRect.width;
    const startContentHeightPx = startRect.height;
    
    const wrapper = cellElement.parentElement?.parentElement;
    const container = wrapper?.parentElement;
    
    if (!wrapper || !container) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const startWrapperWidthPx = wrapperRect.width;
    const containerWidthPx = containerRect.width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // 1. Calculate new dimensions for content
        // We use Math.max to prevent collapse
        const newContentWidthPx = Math.max(50, startContentWidthPx + deltaX);
        const newContentHeightPx = Math.max(50, startContentHeightPx + deltaY);

        // 2. Calculate new wrapper width (for percentage width)
        // wrapper width changes by the same deltaX as the content
        const newWrapperWidthPx = Math.max(
             50 + (startWrapperWidthPx - startContentWidthPx), 
             startWrapperWidthPx + deltaX
        );
        
        const newPercentWidth = (newWrapperWidthPx / containerWidthPx) * 100;
        
        // 3. Calculate new Aspect Ratio
        // Aspect Ratio = Width / Height
        const newRatio = newContentWidthPx / newContentHeightPx;

        onUpdate(item.id, {
            width: Math.max(5, Math.min(100, newPercentWidth)), // Clamp 5% - 100%
            aspectRatio: newRatio
        });
    };

    const handleMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleGeminiAnalysis = async () => {
    if (!item.imageData) return;
    
    setIsAnalyzing(true);
    const label = await analyzeShotType(item.imageData);
    onUpdate(item.id, { shotLabel: label });
    setIsAnalyzing(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.imageData) return;

    try {
      const response = await fetch(item.imageData);
      const blob = await response.blob();
      
      const data = [new ClipboardItem({ 
          [blob.type]: blob,
          'text/plain': new Blob([item.shotLabel || ''], { type: 'text/plain' })
      })];
      
      await navigator.clipboard.write(data);
      
      setIsCopying(true);
      setTimeout(() => setIsCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('复制失败：请确保您的浏览器支持该功能且页面处于活动状态。');
    }
  };

  const toggleImageFit = (e: React.MouseEvent) => {
      e.stopPropagation();
      const modes: ('cover' | 'contain' | 'fill')[] = ['cover', 'contain', 'fill'];
      const currentIdx = modes.indexOf(item.imageFit || 'cover');
      const nextMode = modes[(currentIdx + 1) % modes.length];
      onUpdate(item.id, { imageFit: nextMode });
  };

  const getFitIcon = () => {
      switch(item.imageFit) {
          case 'contain': return <Scan className="w-4 h-4" />;
          case 'fill': return <StretchHorizontal className="w-4 h-4" />;
          default: return <Maximize className="w-4 h-4" />; // Cover
      }
  };

  const getFitLabel = () => {
      switch(item.imageFit) {
          case 'contain': return '完整显示';
          case 'fill': return '拉伸填充';
          default: return '裁剪填充';
      }
  };

  // Handle Drag Over (for file dropping)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Essential to allow dropping
    if (e.dataTransfer.types.includes('Files')) {
       setIsFileDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <div 
      ref={cellRef}
      className={`flex flex-col h-full bg-slate-800 overflow-hidden shadow-sm group relative transition-all hover:shadow-lg ${isFileDragOver ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 scale-[1.02] z-10' : ''}`}
      style={{
        borderWidth: `${styleSettings.borderWidth}px`,
        borderColor: isFileDragOver ? '#6366f1' : styleSettings.borderColor,
        borderRadius: '0.5rem', // Fixed radius for container
        transition: isResizing ? 'none' : 'all 0.2s', // Disable transition during resize for performance
      }}
      draggable={draggable && !isResizing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File Drop Overlay */}
      {isFileDragOver && (
        <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-400 animate-in fade-in duration-200">
           <Upload className="w-10 h-10 mb-2 animate-bounce" />
           <span className="font-semibold text-lg">松开以上传图片</span>
        </div>
      )}

      {/* Drag Handle Overlay (for sorting) */}
      <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 cursor-move bg-black/40 rounded p-1 backdrop-blur-sm transition-opacity hover:bg-black/60">
        <GripVertical className="w-4 h-4 text-white" />
      </div>

      {/* Image Area */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center min-h-[50px]">
        {item.imageData ? (
          <>
            <img 
              src={item.imageData} 
              alt="Shot" 
              className="w-full h-full select-none pointer-events-none"
              style={{ objectFit: item.imageFit || 'cover' }}
            />
            {/* Overlay Actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 items-center">
               <button
                 onClick={toggleImageFit}
                 className="bg-slate-700/80 hover:bg-slate-600 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors mr-1"
                 title={`切换图片适应模式 (${getFitLabel()})`}
               >
                  {getFitIcon()}
               </button>
               <button 
                onClick={handleCopy}
                className="bg-slate-700/80 hover:bg-slate-600 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors mr-1"
                title="复制图片和标签"
              >
                {isCopying ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
               <label className="bg-slate-700/80 hover:bg-slate-600 text-white p-1.5 rounded-full backdrop-blur-sm cursor-pointer" title="替换图片">
                 <Upload className="w-4 h-4" />
                 <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
               </label>
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full backdrop-blur-sm"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-slate-500 hover:text-indigo-400 hover:bg-slate-800/50 transition-all p-4">
              <Upload className="w-8 h-8 mb-2 opacity-50" />
              <span className="text-xs text-center opacity-50">点击或拖拽上传</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileSelect}
              />
            </label>
            {/* Delete button for empty state */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="bg-slate-800/80 hover:bg-red-600 text-slate-400 hover:text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                title="删除格子"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer / Labeling */}
      <div className="p-2 bg-slate-800 border-t relative" style={{ borderColor: styleSettings.borderColor }}>
        <div className="flex gap-2 items-center">
           <div className="relative flex-1">
             <input
               type="text"
               value={item.shotLabel}
               onChange={(e) => onUpdate(item.id, { shotLabel: e.target.value })}
               placeholder="镜头类型..."
               style={{ 
                   fontSize: `${styleSettings.fontSize}px`,
                   color: styleSettings.fontColor
               }}
               className="w-full bg-transparent border border-slate-600/50 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-600"
             />
             {/* Preset Dropdown Toggle */}
             <button 
                onClick={() => setShowPresets(!showPresets)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
             >
                <MoreHorizontal className="w-3 h-3" />
             </button>
             
             {showPresets && (
                <div className="absolute bottom-full left-0 w-full bg-slate-700 rounded shadow-xl border border-slate-600 mb-1 z-20 max-h-48 overflow-y-auto">
                    {SHOT_PRESETS.map(preset => (
                        <button
                            key={preset}
                            onClick={() => {
                                onUpdate(item.id, { shotLabel: preset });
                                setShowPresets(false);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 transition-colors"
                        >
                            {preset}
                        </button>
                    ))}
                </div>
             )}
           </div>

           <Button 
             variant="ghost" 
             size="sm"
             disabled={!item.imageData || isAnalyzing}
             isLoading={isAnalyzing}
             onClick={handleGeminiAnalysis}
             title="AI 识别"
             className="px-1 text-indigo-400 hover:text-indigo-300"
           >
             <Sparkles className="w-4 h-4" />
           </Button>
        </div>
      </div>

       {/* Resize Handle - Bottom Right Corner */}
       <div 
        className="absolute bottom-0 right-0 w-6 h-6 z-30 cursor-nwse-resize flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleMouseDownResizeCorner}
        title="拖动调整大小 (宽/高)"
      >
          {/* Visual indicator corner */}
          <div className="w-2 h-2 border-r-2 border-b-2 border-indigo-400/80 rounded-br-sm group-hover/handle:border-indigo-200"></div>
          {isResizing && item.width && (
             <div className="absolute bottom-6 right-0 bg-black text-white text-xs px-1 py-0.5 rounded whitespace-nowrap">
               {Math.round(item.width)}%
             </div>
          )}
      </div>
    </div>
  );
};