import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPdfPageToCanvas } from '../../utils/pdfParser';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
  Crop,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize
} from 'lucide-react';

interface PdfPageViewerProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  highlightQuestionNum?: number | string;
  onPageChange?: (newPage: number) => void;
  onCropImage?: (dataUrl: string) => void;
}

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({
  pdfDoc,
  pageNumber,
  highlightQuestionNum,
  onPageChange,
  onCropImage,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState<number>(1.3);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Crop from PDF State
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsCropping(false);
    setCropRect(null);

    const render = async () => {
      try {
        if (canvasRef.current) {
          await renderPdfPageToCanvas(pdfDoc, pageNumber, canvasRef.current, scale);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('PDF page render error:', err);
          setError(err.message || 'Failed to render PDF page');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    render();

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, pageNumber, scale]);

  const handleZoomIn = () => setScale((s) => Math.min(3.5, Number((s + 0.2).toFixed(1))));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))));
  const handleResetZoom = () => setScale(1.3);

  const handleFitWidth = () => {
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      const currentWidth = canvasRef.current.width / (window.devicePixelRatio || 1);
      if (currentWidth > 0) {
        const ratio = containerWidth / (currentWidth / scale);
        setScale(Number(Math.max(0.7, Math.min(2.5, ratio)).toFixed(2)));
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Crop Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropStart({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCropping || !cropStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const width = Math.abs(currentX - cropStart.x);
    const height = Math.abs(currentY - cropStart.y);

    setCropRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setCropStart(null);
  };

  const confirmCrop = () => {
    if (!cropRect || !canvasRef.current || cropRect.width < 10 || cropRect.height < 10) {
      alert('Please drag a selection rectangle over the diagram or figure to crop.');
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;

    const sourceX = cropRect.x * scaleFactorX;
    const sourceY = cropRect.y * scaleFactorY;
    const sourceW = cropRect.width * scaleFactorX;
    const sourceH = cropRect.height * scaleFactorY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sourceW;
    cropCanvas.height = sourceH;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(canvas, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
    const dataUrl = cropCanvas.toDataURL('image/png');

    if (onCropImage) {
      onCropImage(dataUrl);
    }
    setIsCropping(false);
    setCropRect(null);
  };

  const cancelCrop = () => {
    setIsCropping(false);
    setCropRect(null);
    setCropStart(null);
  };

  if (!pdfDoc) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-sm font-semibold">No PDF Document Loaded</p>
        <p className="text-xs text-slate-500 mt-1">Select an active job or upload a PDF to inspect source pages.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner select-none"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300 gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          {onPageChange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(Math.max(1, pageNumber - 1))}
                disabled={pageNumber <= 1}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                title="Previous Page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => onPageChange(Math.min(pdfDoc.numPages, pageNumber + 1))}
                disabled={pageNumber >= pdfDoc.numPages}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                title="Next Page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          <span className="font-bold text-white text-xs">Page</span>
          <span className="px-2 py-0.5 rounded bg-brand-900/50 text-brand-400 font-bold border border-brand-800 text-[11px]">
            {pageNumber} / {pdfDoc.numPages}
          </span>
          {highlightQuestionNum && (
            <span className="ml-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800 text-[11px]">
              Q{highlightQuestionNum}
            </span>
          )}
        </div>

        {/* Action Controls: Zoom, Fit, Crop, Fullscreen */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom to 100%"
              className="px-1.5 font-mono text-[10px] min-w-10 text-center hover:text-white"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <button
            onClick={handleFitWidth}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition"
          >
            Fit Width
          </button>

          {/* Crop From PDF Button */}
          {onCropImage && (
            <>
              {isCropping ? (
                <div className="flex items-center gap-1 bg-amber-950 border border-amber-800 px-1.5 py-0.5 rounded-lg animate-pulse">
                  <span className="text-[10px] text-amber-300 font-bold">Select Area</span>
                  <button
                    onClick={confirmCrop}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                    title="Confirm Crop"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelCrop}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    title="Cancel Crop"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCropping(true)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 text-[11px] font-semibold transition flex items-center gap-1"
                  title="Crop diagram or formula from PDF"
                >
                  <Crop size={12} />
                  <span>Crop Image</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        className={`flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950/80 ${
          isCropping ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 z-20 backdrop-blur-2xs">
            <Loader2 size={32} className="animate-spin text-brand-500 mb-2" />
            <p className="text-xs text-slate-300 font-medium">Rendering PDF page {pageNumber}...</p>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-rose-400 bg-rose-950/20 border border-rose-900 rounded-xl">
            <AlertCircle size={28} className="mb-2 text-rose-500" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : (
          <div className="relative shadow-2xl border border-slate-800 rounded-lg overflow-hidden bg-white">
            <canvas ref={canvasRef} className="block" />

            {/* Interactive Crop Box Overlay */}
            {isCropping && cropRect && cropRect.width > 0 && cropRect.height > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${cropRect.x}px`,
                  top: `${cropRect.y}px`,
                  width: `${cropRect.width}px`,
                  height: `${cropRect.height}px`,
                }}
                className="border-2 border-dashed border-amber-400 bg-amber-400/20 pointer-events-none z-30"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
