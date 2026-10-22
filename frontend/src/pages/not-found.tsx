import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="settle flex flex-col items-center py-24 text-center">
      <p className="font-condensed text-[13px] font-bold tracking-[0.2em] text-ink-3 uppercase">Off track</p>
      <h1 className="font-display mt-2 text-[64px] leading-none font-bold text-ink">404</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-3">
        This page doesn't exist — the run may have been deleted, or the link is stale.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="primary">Back to the season board</Button>
      </Link>
    </div>
  );
}
