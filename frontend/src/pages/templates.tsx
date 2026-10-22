import { useNavigate } from 'react-router-dom';
import { Flag, Share2 } from 'lucide-react';
import { useTemplateMutations, useTemplates } from '../lib/queries';
import { errorText } from '../lib/api';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, ConfirmButton, EmptyState, Loading, useToast } from '../components/ui';
import { Stripe } from '../components/livery';
import { formatAgo } from '../lib/format';

export default function TemplatesPage() {
  const templates = useTemplates();
  const { update, remove } = useTemplateMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const guest = isGuest(user);

  return (
    <div className="settle">
      <PageHeader
        title="Templates"
        sub="Saved setups — create one from any run's Setup tab, reuse it for the next iteration."
      />
      {templates.isLoading ? (
        <Loading label="Loading templates" />
      ) : templates.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.data.map((t) => {
            const mine = t.user_id === user?.id;
            return (
              <div key={t.id} className="flex items-stretch border border-seam bg-paper">
                <Stripe id={t.id} />
                <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span className="truncate">{t.name}</span>
                        {t.is_recommended && (
                          <span className="font-condensed flex items-center gap-1 rounded-[3px] bg-race-tint px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-race-deep uppercase">
                            <Flag size={10} /> Team standard
                          </span>
                        )}
                        {t.is_shared && (
                          <span className="font-condensed flex items-center gap-1 rounded-[3px] bg-ground px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-ink-2 uppercase">
                            <Share2 size={10} /> Shared
                          </span>
                        )}
                      </p>
                      {t.description && <p className="mt-0.5 text-xs text-ink-3">{t.description}</p>}
                      <p className="mt-0.5 text-xs text-ink-3">v{t.version} · {formatAgo(t.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    {!guest && (
                      <Button
                        variant="primary"
                        onClick={() => navigate('/runs/new', { state: { template: t.config } })}
                      >
                        Use template
                      </Button>
                    )}
                    {mine && !guest && (
                      <>
                        <Button
                          variant="ghost"
                          busy={update.isPending}
                          onClick={() =>
                            update
                              .mutateAsync({ id: t.id, body: { is_shared: !t.is_shared } })
                              .then(() => toast('ok', t.is_shared ? 'Template unshared' : 'Template shared with the team'))
                              .catch((e) => toast('error', errorText(e)))
                          }
                        >
                          {t.is_shared ? 'Unshare' : 'Share'}
                        </Button>
                        <span className="mx-1 h-5 w-px bg-seam" aria-hidden />
                        <ConfirmButton
                          label="Delete"
                          variant="ghost"
                          busy={remove.isPending}
                          onConfirm={() =>
                            remove
                              .mutateAsync(t.id)
                              .then(() => toast('ok', 'Template deleted'))
                              .catch((e) => toast('error', errorText(e)))
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No templates"
          detail="Open a finished run → Setup tab → “Save as template” to capture a proven configuration."
        />
      )}
    </div>
  );
}
