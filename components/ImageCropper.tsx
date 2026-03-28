import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { Check, X, Crop as CropIcon, Plus, ClipboardPaste, Upload, ImageIcon } from 'lucide-react';
import { CropState } from '../types';

interface ImageCropperProps {
  imageUrl: string | null;
  onCancel: () => void;
  onExtract: (croppedImageBase64: string) => void; // Keeps modal open
  onComplete: (croppedImageBase64: string) => void; // Closes modal
  onImageReplace: (newUrl: string) => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ 
  imageUrl, 
  onCancel, 
  onExtract,
  onComplete,
  onImageReplace
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [crop, setCrop] = useState<CropState>({ x: 10, y: 10, width: 50, height: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropState>({ x: 0, y: 0, width: 0, height: 0 });
  const [action, setAction] = useState<'move' | 'resize-se'>('move');

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            onImageReplace(event.target.result as string);
                        }
                    };
                    reader.readAsDataURL(blob);
                }
                break;
            }
        }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImageReplace]);

  // Handle File Upload from within Modal
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onImageReplace(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Calculate crop rectangle in percentages
  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-se') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setAction(type);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...crop });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const deltaXPercent = ((e.clientX - dragStart.x) / containerRef.current.offsetWidth) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y) / containerRef.current.offsetHeight) * 100;

    setCrop((prev) => {
      let newCrop = { ...prev };

      if (action === 'move') {
        newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent));
        newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent));
      } else if (action === 'resize-se') {
        newCrop.width = Math.max(5, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent));
        newCrop.height = Math.max(5, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent));
      }
      return newCrop;
    });
  }, [isDragging, dragStart, action, startCrop]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getCroppedBase64 = () => {
    if (!imageRef.current) return null;
    
    const canvas = document.createElement('canvas');
    const image = imageRef.current;
    
    // Natural dimensions vs Display dimensions
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Convert percentage crop to pixels
    const pixelX = (crop.x / 100) * image.width * scaleX;
    const pixelY = (crop.y / 100) * image.height * scaleY;
    const pixelWidth = (crop.width / 100) * image.width * scaleX;
    const pixelHeight = (crop.height / 100) * image.height * scaleY;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      image,
      pixelX,
      pixelY,
      pixelWidth,
      pixelHeight,
      0,
      0,
      pixelWidth,
      pixelHeight
    );

    return canvas.toDataURL('image/png');
  };

  const handleExtract = () => {
      const base64 = getCroppedBase64();
      if (base64) onExtract(base64);
  };

  const handleComplete = () => {
      const base64 = getCroppedBase64();
      if (base64) onComplete(base64);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center space-x-2 text-slate-100">
            <CropIcon className="w-5 h-5" />
            <h3 className="font-semibold text-lg">裁剪与提取</h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" onClick={onCancel} size="sm">
              <X className="w-4 h-4 mr-1" /> 取消
            </Button>
            {imageUrl && (
              <>
                <Button variant="secondary" onClick={handleExtract} size="sm" className="hidden sm:inline-flex">
                  <Plus className="w-4 h-4 mr-1" /> 提取到网格
                </Button>
                <Button variant="primary" onClick={handleComplete} size="sm">
                  <Check className="w-4 h-4 mr-1" /> 完成
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-950 relative select-none min-h-[400px]">
          {imageUrl ? (
            <div className="relative inline-block" ref={containerRef}>
              <img
                ref={imageRef}
                src={imageUrl}
                alt="To Crop"
                className="max-h-[70vh] max-w-full object-contain pointer-events-none"
                draggable={false}
              />
              
              {/* Overlay */}
              <div
                className="absolute inset-0 bg-black/50"
                style={{
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 
                    ${crop.x}% 100%, ${crop.x}% ${crop.y}%, 
                    ${crop.x + crop.width}% ${crop.y}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, 
                    ${crop.x}% ${crop.y + crop.height}%, ${crop.x}% 100%, 
                    100% 100%, 100% 0%
                  )`
                }}
              ></div>

              {/* Crop Box */}
              <div
                className="absolute border-2 border-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move group"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* Grid Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-30">
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/50"></div>
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/50"></div>
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50"></div>
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50"></div>
                </div>

                {/* Resize Handle (Bottom Right) */}
                <div
                  className="absolute -bottom-2 -right-2 w-6 h-6 bg-indigo-600 rounded-full cursor-se-resize flex items-center justify-center shadow-md z-10 hover:scale-110 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'resize-se')}
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-md w-full p-10 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
               <div className="p-4 bg-slate-800 rounded-full shadow-lg">
                 <ImageIcon className="w-12 h-12 text-indigo-400" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-bold text-slate-200">上传图片以开始</h3>
                 <p className="text-sm text-slate-400">选择一张图片进行裁剪、提取或分镜制作</p>
               </div>
               
               <div className="flex flex-col w-full gap-3">
                 <Button onClick={handleUploadClick} className="w-full shadow-lg shadow-indigo-500/20">
                    <Upload className="w-5 h-5 mr-2" /> 选择文件
                 </Button>
                 <div className="text-xs text-slate-500 font-mono bg-slate-900/50 py-2 rounded">
                   或直接按下 <span className="text-slate-300 font-bold">Ctrl + V</span> 粘贴
                 </div>
               </div>
               
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
            </div>
          )}
        </div>
        
        <div className="bg-slate-800 p-3 flex justify-between items-center text-xs text-slate-400 border-t border-slate-700">
           <span>{imageUrl ? "拖动方框移动 • 拖动蓝色手柄缩放" : "准备就绪"}</span>
           <span className="flex items-center"><ClipboardPaste className="w-3 h-3 mr-1" /> 支持 Ctrl+V 粘贴新图片</span>
        </div>
      </div>
    </div>
  );
};