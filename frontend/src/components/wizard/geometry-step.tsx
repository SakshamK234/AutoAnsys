import { useState } from 'react';
import { useGeometries } from '@/hooks/use-geometries';
import { useGroups, useCreateGroup, useJoinGroup } from '@/hooks/use-groups';
import { formatFileSize } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Plus, UserPlus, Copy, Check, Users } from 'lucide-react';

interface GeometryStepProps {
  name: string;
  setName: (name: string) => void;
  geometryId: string;
  setGeometryId: (id: string) => void;
  groupId: string;
  setGroupId: (id: string) => void;
}

export function GeometryStep({ name, setName, geometryId, setGeometryId, groupId, setGroupId }: GeometryStepProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useGeometries();
  const geometries = data?.items ?? [];
  const { data: groups, isLoading: groupsLoading } = useGroups();

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [groupError, setGroupError] = useState('');

  const createGroup = useCreateGroup();
  const joinGroup = useJoinGroup();

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setGroupError('');
    try {
      const group = await createGroup.mutateAsync({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
      });
      setGroupId(group.id);
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err: any) {
      setGroupError(err.response?.data?.detail || 'Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    setGroupError('');
    try {
      const group = await joinGroup.mutateAsync(inviteCode.trim());
      setGroupId(group.id);
      setShowJoinGroup(false);
      setInviteCode('');
    } catch (err: any) {
      setGroupError(err.response?.data?.detail || 'Failed to join group');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const selectedGroup = groups?.find((g) => g.id === groupId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Simulation Setup</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Name your simulation, pick a geometry, and optionally assign it to a group.</p>
      </div>

      {/* Simulation Name */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Simulation Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Front Wing v3 — 20 m/s"
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
        />
        {name.length > 0 && !name.trim() && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
            <AlertCircle className="h-3 w-3" /> Name cannot be only whitespace
          </p>
        )}
      </div>

      {/* Geometry Selector */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Select Geometry <span className="text-rose-500">*</span>
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Loading geometries...</span>
          </div>
        ) : geometries.length === 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No geometries uploaded yet.
            </p>
            <button
              type="button"
              onClick={() => navigate('/geometries')}
              className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
            >
              Go to Geometry Library to upload one
            </button>
          </div>
        ) : (
          <select
            value={geometryId}
            onChange={(e) => setGeometryId(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
          >
            <option value="">Select a geometry...</option>
            {geometries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.original_name} {g.component_name ? `(${g.component_name})` : ''} — {formatFileSize(g.file_size)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Group Selector */}
      <div>
        <label className="block text-sm font-medium mb-1">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Group <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>
          </span>
        </label>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
          Assign to a group so team members can view results.
        </p>

        {groupsLoading ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Loading groups...</span>
          </div>
        ) : (
          <>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            >
              <option value="">No group (private)</option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.member_count} member{g.member_count !== 1 ? 's' : ''})
                </option>
              ))}
            </select>

            {/* Selected group invite code */}
            {selectedGroup && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-xs">
                <span className="text-[hsl(var(--muted-foreground))]">Invite code:</span>
                <code className="font-mono font-medium">{selectedGroup.invite_code}</code>
                <button
                  type="button"
                  onClick={() => handleCopyCode(selectedGroup.invite_code)}
                  className="ml-auto rounded p-1 hover:bg-[hsl(var(--accent))] transition-colors"
                  title="Copy invite code"
                >
                  {copiedCode === selectedGroup.invite_code
                    ? <Check className="h-3 w-3 text-emerald-500" />
                    : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}

            {/* Create / Join buttons */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCreateGroup(true); setShowJoinGroup(false); setGroupError(''); }}
                className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
              >
                <Plus className="h-3 w-3" /> Create Group
              </button>
              <button
                type="button"
                onClick={() => { setShowJoinGroup(true); setShowCreateGroup(false); setGroupError(''); }}
                className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
              >
                <UserPlus className="h-3 w-3" /> Join Group
              </button>
            </div>
          </>
        )}

        {groupError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-rose-500">
            <AlertCircle className="h-3 w-3" /> {groupError}
          </p>
        )}

        {/* Create group inline form */}
        {showCreateGroup && (
          <div className="mt-3 space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <input
              type="text"
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateGroup(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || createGroup.isPending}
                className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {createGroup.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Join group inline form */}
        {showJoinGroup && (
          <div className="mt-3 space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste invite code"
              className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJoinGroup(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleJoinGroup}
                disabled={!inviteCode.trim() || joinGroup.isPending}
                className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {joinGroup.isPending ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
