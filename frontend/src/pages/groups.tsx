import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Users } from 'lucide-react';
import { useGroup, useGroupMutations, useGroups } from '../lib/queries';
import { errorText } from '../lib/api';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, Dialog, EmptyState, Field, Input, Loading, Panel, useToast } from '../components/ui';
import { formatAgo, formatDate } from '../lib/format';

export default function GroupsPage() {
  const groups = useGroups();
  const { create, join } = useGroupMutations();
  const toast = useToast();
  const { user } = useAuth();
  const guest = isGuest(user);
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detail = useGroup(selected ?? groups.data?.[0]?.id);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const g = await create.mutateAsync({ name, description: description || undefined });
      toast('ok', `Team “${g.name}” created`);
      setCreateOpen(false);
      setName('');
      setDescription('');
      setSelected(g.id);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const g = await join.mutateAsync(code.trim());
      toast('ok', `Joined “${g.name}”`);
      setJoinOpen(false);
      setCode('');
      setSelected(g.id);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="settle">
      <PageHeader
        title="Team"
        sub="Groups share run visibility — teammates see each other's runs, results, and files."
        actions={
          !guest && (
            <>
              <Button onClick={() => setJoinOpen(true)}>Join with code</Button>
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                New group
              </Button>
            </>
          )
        }
      />

      {groups.isLoading ? (
        <Loading label="Loading groups" />
      ) : groups.data?.length ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-2">
            {groups.data.map((g) => {
              const active = (selected ?? groups.data![0].id) === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className={`flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-race bg-race-tint' : 'border-seam bg-paper hover:border-seam-strong'
                  }`}
                >
                  <Users size={16} className={active ? 'text-race-deep' : 'text-ink-3'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.name}</span>
                    <span className="block text-xs text-ink-3">
                      {g.member_count} member{g.member_count === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {detail.data ? (
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">{detail.data.name}</h2>
                  {detail.data.description && <p className="mt-0.5 text-sm text-ink-3">{detail.data.description}</p>}
                  <p className="mt-1 text-xs text-ink-3">created {formatAgo(detail.data.created_at)}</p>
                </div>
                <div className="border border-seam bg-ground px-3 py-2">
                  <p className="font-condensed text-[10px] font-bold tracking-[0.14em] text-ink-3 uppercase">
                    Invite code
                  </p>
                  <p className="flex items-center gap-2">
                    <code className="font-mono text-sm font-semibold tracking-wider">{detail.data.invite_code}</code>
                    <button
                      aria-label="Copy invite code"
                      className="cursor-pointer text-ink-3 hover:text-race"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(detail.data!.invite_code)
                          .then(() => toast('ok', 'Invite code copied'))
                      }
                    >
                      <Copy size={13} />
                    </button>
                  </p>
                </div>
              </div>

              <h3 className="section-head mt-6 mb-3">Members</h3>
              <div className="border border-seam">
                <table className="w-full text-sm">
                  <tbody>
                    {detail.data.members.map((m) => (
                      <tr key={m.id} className="border-b border-seam last:border-0">
                        <td className="px-4 py-2 font-medium">{m.user_name ?? m.user_email ?? m.user_id.slice(0, 8)}</td>
                        <td className="font-condensed px-4 py-2 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">
                          {m.role}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-ink-3">joined {formatDate(m.joined_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5">
                <Link to={`/runs?view=group&group=${detail.data.id}`} className="text-sm font-medium text-race hover:underline">
                  View this team's runs →
                </Link>
              </div>
            </Panel>
          ) : (
            <Loading />
          )}
        </div>
      ) : (
        <EmptyState
          title="No groups yet"
          detail="Create a group for the aero team and share the invite code, or join with a code from your lead."
          action={
            !guest && (
              <div className="flex gap-2">
                <Button onClick={() => setJoinOpen(true)}>Join with code</Button>
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  New group
                </Button>
              </div>
            )
          }
        />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New group">
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Aero 2027" />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
          </Field>
          {error && <p role="alert" className="border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">{error}</p>}
          <Button type="submit" variant="primary" busy={create.isPending}>
            Create group
          </Button>
        </form>
      </Dialog>

      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a group">
        <form onSubmit={onJoin} className="flex flex-col gap-4">
          <Field label="Invite code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} required className="font-mono tracking-wider" />
          </Field>
          {error && <p role="alert" className="border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">{error}</p>}
          <Button type="submit" variant="primary" busy={join.isPending}>
            Join
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
