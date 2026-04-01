import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatFileSize(mb: number): string {
  if (mb >= 1000) {
    return `${(mb / 1000).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function calculateYPlus(
  velocity: number,
  density: number,
  dynamicViscosity: number,
  characteristicLength: number,
  targetYPlus: number
): number {
  const Re = (density * velocity * characteristicLength) / dynamicViscosity;
  const Cf = 0.058 * Math.pow(Re, -0.2);
  const tauWall = 0.5 * Cf * density * velocity * velocity;
  const uFriction = Math.sqrt(tauWall / density);
  const firstLayerHeight = (targetYPlus * dynamicViscosity) / (density * uFriction);
  return firstLayerHeight;
}
