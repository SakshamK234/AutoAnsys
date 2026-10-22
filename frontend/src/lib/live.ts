import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ForcePoint, JobProgress, LiveEvent, ResidualPoint } from '../types';

export interface LiveState {
  connected: boolean;
  progress: JobProgress | null;
  residuals: ResidualPoint[];
  forces: ForcePoint[];
}

/** Live telemetry for a run. Stays connected for the whole page visit
 * (terminal events like results_ready arrive AFTER the status flips, so the
 * socket must outlive the status change), reconnects with backoff, and
 * invalidates the relevant queries when the backend lands new data. */
export function useJobLive(jobId: string | undefined): LiveState {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [residuals, setResiduals] = useState<ResidualPoint[]>([]);
  const [forces, setForces] = useState<ForcePoint[]>([]);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws/jobs/${jobId}/live?token=${token}`);

      ws.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed && retryRef.current < 6) {
          const delay = Math.min(30_000, 1000 * 2 ** retryRef.current);
          retryRef.current += 1;
          timer = setTimeout(connect, delay);
        }
      };
      ws.onmessage = (msg) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(msg.data);
        } catch {
          return;
        }
        switch (event.type) {
          case 'status_update':
            qc.invalidateQueries({ queryKey: ['job', jobId] });
            qc.invalidateQueries({ queryKey: ['jobs'] });
            break;
          case 'progress':
            setProgress(event.data);
            break;
          case 'residual':
            setResiduals((prev) => {
              const point = event.data as ResidualPoint;
              if (prev.length && prev[prev.length - 1].iteration >= point.iteration) return prev;
              return [...prev.slice(-900), point];
            });
            break;
          case 'force':
            setForces((prev) => {
              const point = event.data;
              if (prev.length && prev[prev.length - 1].iteration >= point.iteration) return prev;
              return [...prev.slice(-900), point];
            });
            break;
          case 'results_ready':
            // Files/forces/residuals are committed now — refetch everything.
            qc.invalidateQueries({ queryKey: ['job', jobId] });
            qc.invalidateQueries({ queryKey: ['jobs'] });
            break;
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [jobId, qc]);

  return { connected, progress, residuals, forces };
}
