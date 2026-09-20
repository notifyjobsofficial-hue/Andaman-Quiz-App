import React, { useEffect, useRef, useState } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPdfPageToCanvas } from '../../utils/pdfParser';
import { ZoomIn, ZoomOut, Maximize2, Loader2, AlertCircle } from 'lucide-react';

interface PdfPageViewerProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  highlightQuestionNum?: number | string;
}

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({
  pdfDoc,
  pageNumber,
  highlightQuestionNum,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState<number>(1.3);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

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

  const handleZoomIn = () => setScale((s) => Math.min(3.0, s + 0.2));
  const handleZoomOut = () => setScale((s) => Math.max(0.7, s - 0.2));
  const handleResetZoom = () => setScale(1.3);

  if (!pdfDoc) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-sm font-semibold">No PDF Document Loaded</p>
        <p className="text-xs text-slate-500 mt-1">Select an active job or upload a PDF to inspect source pages.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">Source Page:</span>
          <span className="px-2 py-0.5 rounded bg-brand-900/50 text-brand-400 font-bold border border-brand-800">
            {pageNumber} / {pdfDoc.numPages}
          </span>
          {highlightQuestionNum && (
            <span className="ml-2 px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-800">
              Q{highlightQuestionNum}
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
          >
            <ZoomOut size={14} />
          </button>
          <span className="px-1.5 font-mono text-[11px] min-w-11 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Zoom"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Scrollable Container */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center relative bg-slate-950">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xs text-brand-400">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-xs font-semibold mt-2 text-slate-300">Rendering Page {pageNumber}...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="shadow-2xl rounded-sm border border-slate-700/50 max-w-none transition-all duration-150"
        />
      </div>
    </div>
  );
};
