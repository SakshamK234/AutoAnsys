import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { ResultFile } from '../types';
import { fileDownloadUrl } from '../lib/queries';
import { Plate } from './livery';
import { Loading } from './ui';

const CONTOUR_LABELS: Record<string, string> = {
  'contour_velocity_midplane.png': 'Velocity · mid-span plane',
  'contour_pressure_midplane.png': 'Static pressure · mid-span plane',
  'contour_tke_midplane.png': 'Turbulent kinetic energy · mid-span plane',
  'contour_cp.png': 'Pressure coefficient · body surface',
  'contour_velocity.png': 'Velocity magnitude',
  'contour_pressure.png': 'Static pressure',
  'contour_total_pressure.png': 'Total pressure',
  'contour_wall_shear.png': 'Wall shear stress',
};

interface Loaded {
  file: ResultFile;
  url: string;
  label: string;
}

export function ContourGallery({ jobId, files }: { jobId: string; files: ResultFile[] }) {
  const contours = files.filter((f) => f.file_type === 'contour_image');
  const [loaded, setLoaded] = useState<Loaded[] | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!contours.length) {
      setLoaded([]);
      return;
    }
    Promise.all(
      contours.map(async (file) => ({
        file,
        url: await fileDownloadUrl(jobId, file.id),
        label: CONTOUR_LABELS[file.filename] ?? file.filename,
      })),
    )
      .then((all) => !cancelled && setLoaded(all))
      .catch(() => !cancelled && setLoaded([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, files.length]);

  if (loaded === null) return <Loading label="Fetching contours" />;
  if (!loaded.length)
    return <p className="py-8 text-center text-sm text-ink-3">No contour images for this run.</p>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {loaded.map((c, i) => (
          <Plate key={c.file.id} caption={`Fig. ${i + 1} — ${c.label}`}>
            <button
              className="block w-full cursor-zoom-in"
              onClick={() => setLightbox(i)}
              aria-label={`Open ${c.label} full screen`}
            >
              <img src={c.url} alt={c.label} className="w-full border border-seam" loading="lazy" />
            </button>
          </Plate>
        ))}
      </div>
      {lightbox !== null && (
        <Lightbox items={loaded} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

/** Full-bleed focus viewer (vertical-feed raise): black field, glyph rail. */
function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Loaded[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onIndex]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex bg-[#0b0c0f]">
      <div className="flex min-w-0 flex-1 items-center justify-center p-6">
        <img src={item.url} alt={item.label} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex w-14 flex-col items-center gap-4 py-5">
        <button onClick={onClose} aria-label="Close" className="cursor-pointer p-2 text-white/80 hover:text-white">
          <X size={20} />
        </button>
        <a
          href={item.url}
          download={item.file.filename}
          aria-label="Download image"
          className="p-2 text-white/80 hover:text-white"
        >
          <Download size={18} />
        </a>
        <div className="flex-1" />
        <button
          onClick={() => onIndex((index - 1 + items.length) % items.length)}
          aria-label="Previous"
          className="cursor-pointer p-2 text-white/80 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-mono tnum text-[11px] text-white/60">
          {index + 1}/{items.length}
        </span>
        <button
          onClick={() => onIndex((index + 1) % items.length)}
          aria-label="Next"
          className="cursor-pointer p-2 text-white/80 hover:text-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <p className="font-condensed absolute bottom-4 left-6 text-[12px] font-bold tracking-[0.12em] text-white/70 uppercase">
        {item.label}
      </p>
    </div>,
    document.body,
  );
}
