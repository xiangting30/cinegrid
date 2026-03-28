import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  LayoutGrid, 
  Download, 
  Plus, 
  Scissors, 
  Trash, 
  Image as ImageIcon,
  Columns,
  Sparkles,
  Settings,
  Palette,
  Type,
  GripVertical,
  Maximize
} from 'lucide-react';
import { GridItem, GridColumns, StyleSettings } from './types';
import { Button } from './components/Button';
import { GridCell } from './components/GridCell';
import { ImageCropper } from './components/ImageCropper';

export default function App() {
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [defaultColumns, setDefaultColumns] = useState<GridColumns>(2); // Acts as a preset for new items
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedFileForCrop, setSelectedFileForCrop] = useState<string | null>(null);
  
  // Style State
  const [styleSettings, setStyleSettings] = useState<StyleSettings>({
    gap: 16,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    fontSize: 14,
    fontColor: '#f8fafc', // slate-50
    aspectRatio: '4/5'
  });

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Drag and Drop Refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Helper to calculate default aspect ratio from string
  const getDefaultAspectRatioValue = () => {
    const [w, h] = styleSettings.aspectRatio.split('/').map(Number);
    return w / h;
  };

  // Helper to load image and get dimensions for aspect ratio
  const loadImageAndCreateItem = (dataUrl: string, label: string = ''): Promise<GridItem> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratio = img.width / img.height;
            resolve({
                id: uuidv4(),
                imageData: dataUrl,
                shotLabel: label,
                aspectRatio: ratio,
                imageFit: 'cover',
                width: 100 / defaultColumns // Default width based on column setting
            });
        };
        img.src = dataUrl;
    });
  };

  // --- Paste Handler ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // If modal is open, don't handle global paste here, the modal handles it
      if (isCropperOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = async (event) => {
              if (event.target?.result) {
                const newItem = await loadImageAndCreateItem(event.target.result as string, '粘贴图片');
                setGridItems((prev) => [...prev, newItem]);
              }
            };
            reader.readAsDataURL(blob);
            // Only handle the first image found
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isCropperOpen, defaultColumns]);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
        const _gridItems = [...gridItems];
        const draggedItemContent = _gridItems[dragItem.current];
        _gridItems.splice(dragItem.current, 1);
        _gridItems.splice(dragOverItem.current, 0, draggedItemContent);
        setGridItems(_gridItems);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };


  // --- Item Handlers ---

  const handleAddItem = () => {
    // For empty items, use the default global aspect ratio
    const ratio = getDefaultAspectRatioValue();
    const newItem: GridItem = {
      id: uuidv4(),
      imageData: null,
      shotLabel: '',
      aspectRatio: ratio,
      imageFit: 'cover',
      width: 100 / defaultColumns
    };
    setGridItems([...gridItems, newItem]);
  };

  const handleUpdateItem = async (id: string, updates: Partial<GridItem>) => {
    // If updating image data, update aspectRatio to match new image
    if (updates.imageData) {
        const img = new Image();
        img.onload = () => {
             const ratio = img.width / img.height;
             setGridItems(prev => prev.map(item => item.id === id ? { ...item, ...updates, aspectRatio: ratio } : item));
        };
        img.src = updates.imageData;
    } else {
        setGridItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }
  };

  const handleRemoveItem = (id: string) => {
    setGridItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("确定要清空所有分镜内容吗？")) {
      setGridItems([]);
    }
  };

  // --- Export Logic ---
  const handleExport = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !gridContainerRef.current) return;

    // Simulation Parameters
    const exportWidth = 1600; // High resolution base width
    const gap = styleSettings.gap;
    const textHeightBase = 50 + (styleSettings.fontSize - 14) * 2;
    
    // We simulate Flexbox layout
    // We walk through items.
    // currentX starts at gap.
    // If itemWidth + currentX > exportWidth, wrap to next line (reset X, increment Y by max height of previous row).
    
    interface PositionedItem {
        item: GridItem;
        x: number;
        y: number;
        width: number;
        height: number;
        imageHeight: number;
    }

    const positionedItems: PositionedItem[] = [];
    
    let currentX = gap;
    let currentY = gap;
    let currentRowHeight = 0;
    
    // To handle vertical spacing, we need to know when a row ends to update Y.
    // But since flexbox wraps automatically, we can simulate it linearly.
    // However, row height is determined by the tallest item in that row.
    // We need to buffer items in the current row, then when wrap happens, place them.
    
    let currentRowItems: { item: GridItem, width: number, imageHeight: number, totalHeight: number }[] = [];
    
    const flushRow = () => {
        // Calculate max height for this row
        let maxH = 0;
        currentRowItems.forEach(i => { if (i.totalHeight > maxH) maxH = i.totalHeight; });
        currentRowHeight = maxH;
        
        // Assign positions
        let rowX = gap;
        currentRowItems.forEach(p => {
            positionedItems.push({
                item: p.item,
                x: rowX,
                y: currentY,
                width: p.width,
                height: p.totalHeight,
                imageHeight: p.imageHeight
            });
            rowX += p.width + gap;
        });
        
        // Move Y cursor
        currentY += currentRowHeight + gap;
        // Reset row
        currentRowItems = [];
    };

    gridItems.forEach(item => {
        // Effective width in the flex container simulation
        // In CSS: width = percentage.
        // We simulate "padding gap" model effectively by using width = (totalWidth * percent) - gap?
        // No, in our CSS model: container has negative margin, items have padding.
        // The visual width of the card is (ContainerWidth * Percent) - Gap.
        // Wait, if item is 50%, it takes half space. Inside it has padding.
        // So visual width = (ExportWidth * Percent) - Gap is incorrect because the Gap is internal padding.
        
        // Let's model strictly what we see.
        // The "Cell" (border box) width is (TotalWidth + Gap) * Percent - Gap.
        // Simplified: The slot width is TotalWidth * Percent. The card width is SlotWidth - Gap.
        
        // Let's treat the export canvas as the "Container with negative margins" conceptually? No too complex.
        
        // Let's simple model:
        // Available width for content = exportWidth.
        // But in CSS we have `margin: -gap/2`.
        // Let's say effective width is `exportWidth + gap`.
        
        const effectiveContainerWidth = exportWidth + gap;
        const percent = item.width || (100 / (item.colSpan || defaultColumns)); // Fallback
        
        const slotWidth = effectiveContainerWidth * (percent / 100);
        const cardWidth = slotWidth - gap;
        
        // Aspect Ratio determines image height based on CARD width
        const ratio = item.aspectRatio || getDefaultAspectRatioValue();
        const imageHeight = cardWidth / ratio;
        const totalHeight = imageHeight + textHeightBase;

        // Will this item fit in current row?
        // Current X tracks the SLOT position.
        // currentX starts at 0?
        // If currentX + slotWidth > effectiveContainerWidth + epsilon, wrap.
        
        // Let's refine the X cursor.
        // Initial X = 0.
        // Item 1 (50%): slotWidth = (1600+16)*0.5 = 808.
        // Next X = 808.
        // Item 2 (50%): 808 + 808 = 1616 = effectiveWidth. Fits.
        
        // Check fit
        // Use slight tolerance for floating point
        if (currentRowItems.length > 0 && (currentX + slotWidth > effectiveContainerWidth + 1)) {
             flushRow();
             currentX = 0;
        }

        currentRowItems.push({
            item,
            width: cardWidth,
            imageHeight,
            totalHeight
        });
        
        currentX += slotWidth;
    });
    
    // Flush last row
    if (currentRowItems.length > 0) flushRow();

    // Final Canvas Size
    canvas.width = exportWidth; // Real width
    canvas.height = currentY;   // Calculated height

    // Fill Background
    ctx.fillStyle = '#0f172a'; // Slate 900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw
    let loadedCount = 0;
    const itemsWithImages = positionedItems.filter(p => p.item.imageData);
    const totalImages = itemsWithImages.length;

    const finalizeDownload = () => {
      const link = document.createElement('a');
      link.download = `cinegrid-storyboard-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    const drawItem = (p: PositionedItem) => {
        // p.x and p.y are essentially "Slot" positions if we considered gap logic, 
        // but we calculated p.x in `flushRow` starting at `gap`?
        // Wait, in `flushRow`, `rowX` started at `gap`.
        // In our padding model:
        // Item 1: padding-left: gap/2. 
        // We need to render the CARD at (p.x, p.y).
        
        // Let's re-verify `flushRow` logic relative to canvas.
        // We want uniform gap.
        // Row 1: Item 1. x = gap/2 (if using neg margin logic)?
        // Simpler: Just place items with gap between them.
        // If we have row items, we just space them out?
        // No, their widths are fixed by %.
        // So we just place them.
        
        // Re-calibrating `flushRow` for drawing:
        // We have `p.width` (the card width).
        // We just need to center them or justify them? 
        // Flex-start is default.
        
        // In CSS model:
        // Container has `margin: -8px`.
        // Item has `padding: 8px`.
        // Visual starts at 0 if container is inside a parent with overflow hidden?
        
        // Let's just draw them simply.
        // X = p.x.
        // Wait, `rowX` in `flushRow` was `gap`? 
        // If we want exact visual parity:
        // Canvas left edge = Container left edge.
        // Item 1 starts at `gap/2` visual offset?
        
        // Let's stick to a clean grid look for export.
        // X starts at `gap`.
        // Next item X = prevX + prevWidth + gap.
        
        const x = p.x;
        const y = p.y;
        
        // Draw Cell Container (Background)
        ctx.fillStyle = '#1e293b'; 
        ctx.fillRect(x, y, p.width, p.height);

        // Draw Border
        if (styleSettings.borderWidth > 0) {
            ctx.strokeStyle = styleSettings.borderColor;
            ctx.lineWidth = styleSettings.borderWidth;
            ctx.strokeRect(x, y, p.width, p.height);
        }

        // Draw Text Area Background
        ctx.fillStyle = '#1e293b'; 
        ctx.fillRect(x, y + p.imageHeight, p.width, textHeightBase);
        
        // Draw Label Text
        ctx.fillStyle = styleSettings.fontColor;
        ctx.font = `${styleSettings.fontSize + 4}px Arial`;
        ctx.fillText(p.item.shotLabel || '未命名镜头', x + 12, y + p.imageHeight + textHeightBase/1.8);

        // Draw Image
        if (p.item.imageData) {
            const img = new Image();
            img.onload = () => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(x + (styleSettings.borderWidth/2), y + (styleSettings.borderWidth/2), p.width - styleSettings.borderWidth, p.imageHeight - styleSettings.borderWidth);
                ctx.clip();
                
                const fit = p.item.imageFit || 'cover';
                let renderW, renderH, renderX, renderY;
                const imgRatio = img.width / img.height;
                const targetRatio = p.width / p.imageHeight;

                if (fit === 'fill') {
                     renderW = p.width;
                     renderH = p.imageHeight;
                     renderX = 0;
                     renderY = 0;
                } else if (fit === 'contain') {
                     if (imgRatio > targetRatio) {
                         renderW = p.width;
                         renderH = p.width / imgRatio;
                         renderX = 0;
                         renderY = (p.imageHeight - renderH) / 2;
                     } else {
                         renderH = p.imageHeight;
                         renderW = p.imageHeight * imgRatio;
                         renderY = 0;
                         renderX = (p.width - renderW) / 2;
                     }
                } else {
                    if (imgRatio > targetRatio) {
                        renderH = p.imageHeight;
                        renderW = p.imageHeight * imgRatio;
                        renderY = 0;
                        renderX = (p.width - renderW) / 2;
                    } else {
                        renderW = p.width;
                        renderH = p.width / imgRatio;
                        renderX = 0;
                        renderY = (p.imageHeight - renderH) / 2;
                    }
                }
                
                ctx.drawImage(img, x + renderX, y + renderY, renderW, renderH);
                ctx.restore();

                loadedCount++;
                if (loadedCount === totalImages) finalizeDownload();
            };
            img.src = p.item.imageData;
        } else {
             ctx.fillStyle = '#475569';
             ctx.font = '24px sans-serif';
             ctx.fillText("无图片", x + p.width/2 - 40, y + p.imageHeight/2);
             if (itemsWithImages.length === 0 && p === positionedItems[positionedItems.length-1]) finalizeDownload();
        }
    };

    if (positionedItems.length === 0) {
        alert("没有内容可导出");
        return;
    }

    if (totalImages === 0) {
        positionedItems.forEach(drawItem);
        finalizeDownload();
    } else {
        positionedItems.forEach(drawItem);
    }
  };

  // --- Crop Logic ---

  const handleCropToolClick = () => {
    setIsCropperOpen(true);
    setSelectedFileForCrop(null); // Open with empty state
  };

  const handleCropAdd = (croppedBase64: string) => {
    loadImageAndCreateItem(croppedBase64, '裁剪素材').then(newItem => {
        setGridItems(prev => [...prev, newItem]);
    });
  };

  const handleCropComplete = (croppedBase64: string) => {
    handleCropAdd(croppedBase64);
    setIsCropperOpen(false);
    setSelectedFileForCrop(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100 font-sans">
      {/* Navbar */}
      <header className="h-16 border-b border-slate-700 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            CineGrid 分镜工作室
          </h1>
        </div>
        <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={handleClearAll} disabled={gridItems.length === 0}>
                <Trash className="w-4 h-4 mr-2" /> 清空
            </Button>
            <Button variant="primary" size="sm" onClick={handleExport} disabled={gridItems.length === 0}>
                <Download className="w-4 h-4 mr-2" /> 导出 PNG
            </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar / Toolbox */}
        <aside className="lg:w-72 flex-shrink-0 space-y-6 overflow-y-auto max-h-[calc(100vh-100px)] custom-scrollbar pr-2">
            
            {/* Quick Actions */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Plus className="w-3 h-3 mr-1" /> 基础操作
                </h2>
                <div className="space-y-3">
                    <Button 
                        variant="primary" 
                        className="w-full justify-start shadow-md" 
                        onClick={handleAddItem}
                    >
                        <Plus className="w-5 h-5 mr-3" /> 添加空格子
                    </Button>
                    <div className="relative">
                        <Button 
                            variant="secondary" 
                            className="w-full justify-start border border-slate-600" 
                            onClick={handleCropToolClick}
                        >
                            <Scissors className="w-5 h-5 mr-3" /> 裁剪与提取
                        </Button>
                    </div>
                </div>
            </div>

            {/* Layout Settings */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
                 <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Columns className="w-3 h-3 mr-1" /> 默认列数
                 </h2>
                 <p className="text-xs text-slate-500 mb-3">新添加格子的默认宽度</p>
                 
                 {/* Columns */}
                 <div className="mb-4">
                     <div className="flex bg-slate-700 p-1 rounded-lg">
                         {[1, 2, 3, 4].map(num => (
                             <button
                                key={num}
                                onClick={() => setDefaultColumns(num as GridColumns)}
                                className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${
                                    defaultColumns === num 
                                    ? 'bg-indigo-600 text-white shadow' 
                                    : 'text-slate-400 hover:text-white'
                                }`}
                             >
                                 {num}
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Aspect Ratio */}
                 <div>
                    <div className="flex justify-between text-sm mb-2 text-slate-300">默认比例</div>
                    <select 
                        value={styleSettings.aspectRatio}
                        onChange={(e) => setStyleSettings({...styleSettings, aspectRatio: e.target.value})}
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="1/1">1:1 (正方形)</option>
                        <option value="4/5">4:5 (社交媒体)</option>
                        <option value="4/3">4:3 (标准)</option>
                        <option value="16/9">16:9 (宽屏)</option>
                        <option value="9/16">9:16 (竖屏)</option>
                        <option value="2.35/1">2.35:1 (电影)</option>
                    </select>
                 </div>
            </div>

             {/* Style Settings */}
             <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Palette className="w-3 h-3 mr-1" /> 样式微调
                </h2>

                {/* Gap & Border Size */}
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span>间距</span>
                            <span>{styleSettings.gap}px</span>
                        </div>
                        <input 
                            type="range" min="0" max="40" step="4"
                            value={styleSettings.gap}
                            onChange={(e) => setStyleSettings({...styleSettings, gap: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span>边框粗细</span>
                            <span>{styleSettings.borderWidth}px</span>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="1"
                            value={styleSettings.borderWidth}
                            onChange={(e) => setStyleSettings({...styleSettings, borderWidth: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">边框颜色</label>
                        <div className="flex items-center bg-slate-700 rounded p-1">
                            <input 
                                type="color" 
                                value={styleSettings.borderColor}
                                onChange={(e) => setStyleSettings({...styleSettings, borderColor: e.target.value})}
                                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <span className="text-xs ml-2 text-slate-300 font-mono">{styleSettings.borderColor}</span>
                        </div>
                    </div>
                     <div>
                        <label className="text-xs text-slate-400 block mb-1">字体颜色</label>
                        <div className="flex items-center bg-slate-700 rounded p-1">
                            <input 
                                type="color" 
                                value={styleSettings.fontColor}
                                onChange={(e) => setStyleSettings({...styleSettings, fontColor: e.target.value})}
                                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                            />
                            <span className="text-xs ml-2 text-slate-300 font-mono">{styleSettings.fontColor}</span>
                        </div>
                    </div>
                </div>

                {/* Font Size */}
                 <div className="mt-4">
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span className="flex items-center"><Type className="w-3 h-3 mr-1"/> 字体大小</span>
                            <span>{styleSettings.fontSize}px</span>
                        </div>
                        <input 
                            type="range" min="12" max="32" step="1"
                            value={styleSettings.fontSize}
                            onChange={(e) => setStyleSettings({...styleSettings, fontSize: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                 </div>
            </div>

            {/* Hint */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
                 提示：
                 <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>按住格子左上角 <GripVertical className="inline w-3 h-3"/> 拖动排序。</li>
                    <li>拖动格子<b>右下角</b>调整宽和高。</li>
                    <li>左右拖动调整宽度，上下拖动调整高度。</li>
                    <li>图片适应模式：点击格子上的 <Maximize className="inline w-3 h-3"/> 切换。</li>
                 </ul>
            </div>
        </aside>

        {/* Grid Area */}
        <section 
            className="flex-1 bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-800 p-4 relative overflow-y-auto custom-scrollbar"
        >
            {gridItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                    <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">分镜板是空的</p>
                    <p className="text-sm mt-2 opacity-60">请添加格子或裁剪图片以开始</p>
                </div>
            ) : (
                <div 
                    ref={gridContainerRef}
                    className="flex flex-wrap align-start content-start" 
                    style={{ 
                        margin: `-${styleSettings.gap / 2}px`, // Offset padding for perfect flush edges
                        width: `calc(100% + ${styleSettings.gap}px)`
                    }}
                >
                    {gridItems.map((item, index) => (
                        <div 
                            key={item.id} 
                            style={{ 
                                width: `${item.width || (100 / (item.colSpan || defaultColumns))}%`, // Fallback
                                padding: `${styleSettings.gap / 2}px`, // Padding acts as gap
                                // Aspect ratio on the wrapper isn't sufficient in flex if we want height to be driven by width.
                                // We put aspect-ratio on the inner cell.
                            }}
                            className="relative box-border"
                        >
                            <div 
                                style={{
                                    aspectRatio: `${item.aspectRatio || getDefaultAspectRatioValue()}`
                                }}
                            >
                                <GridCell 
                                    item={item}
                                    styleSettings={styleSettings}
                                    onUpdate={handleUpdateItem} 
                                    onRemove={handleRemoveItem}
                                    onImageUpload={(file) => {
                                        const reader = new FileReader();
                                        reader.onload = () => handleUpdateItem(item.id, { imageData: reader.result as string });
                                        reader.readAsDataURL(file);
                                    }}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragEnter={() => handleDragEnter(index)}
                                    onDragEnd={handleDragEnd}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>

      </main>

      {/* Modals */}
      {isCropperOpen && (
        <ImageCropper 
            imageUrl={selectedFileForCrop} 
            onCancel={() => {
                setIsCropperOpen(false);
                setSelectedFileForCrop(null);
            }} 
            onExtract={handleCropAdd}
            onComplete={handleCropComplete}
            onImageReplace={setSelectedFileForCrop}
        />
      )}
    </div>
  );
}