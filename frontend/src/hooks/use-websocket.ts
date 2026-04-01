import { useEffect, useRef, useState, useCallback } from 'react';
import type { ResidualData, ForceReport } from '@/types';

interface LiveData {
  residuals: ResidualData[];
  forces: ForceReport[];
  connected: boolean;
  error: string | null;
}

export function useWebSocket(jobId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [data, setData] = useState<LiveData>({
    residuals: [],
    forces: [],
    connected: false,
    error: null,
  });

  const connect = useCallback(() => {
    if (!jobId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/jobs/${jobId}/live`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setData((prev) => ({ ...prev, connected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'residual') {
          setData((prev) => ({
            ...prev,
            residuals: [...prev.residuals, msg.data as ResidualData],
          }));
        } else if (msg.type === 'force') {
          setData((prev) => ({
            ...prev,
            forces: [...prev.forces, msg.data as ForceReport],
          }));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setData((prev) => ({ ...prev, error: 'WebSocket connection error' }));
    };

    ws.onclose = () => {
      setData((prev) => ({ ...prev, connected: false }));
    };
  }, [jobId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const reset = useCallback(() => {
    setData({ residuals: [], forces: [], connected: data.connected, error: null });
  }, [data.connected]);

  return { ...data, reset };
}
