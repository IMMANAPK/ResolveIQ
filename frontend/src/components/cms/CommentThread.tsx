import { useState, useEffect } from 'react';
import { useComments, usePostComment, useDeleteComment } from '@/hooks/useComments';
import { CommentInput } from './CommentInput';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiComment } from '@/types/api';

// Note: `useState` is used only for `activeTab` — `page` was removed in favour of useInfiniteQuery

const PRIVILEGED = ['admin', 'manager', 'committee_member'];

interface Props {
  complaintId: string;
  isClosed: boolean;
}

function CommentBubble({
  comment,
  currentUserId,
  isAdmin,
  onDelete,
}: {
  comment: ApiComment;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete: (id: string) => void;
}) {
  const isDeleted = !!comment.deletedAt;
  const canDelete = !isDeleted && (isAdmin || comment.authorId === currentUserId);

  return (
    <div
      className={`rounded-lg p-3 text-sm space-y-1 ${
        comment.isInternal
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-muted/40 border'
      }`}
    >
      {!isDeleted && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {comment.author?.fullName?.[0]?.toUpperCase() ?? '?'}
            </span>
            <span className="font-medium text-foreground">{comment.author?.fullName ?? 'Unknown'}</span>
            {comment.authorRole && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                {comment.authorRole.replace('_', ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      <p
        className={`whitespace-pre-wrap leading-relaxed ${isDeleted ? 'text-muted-foreground italic' : 'text-foreground'}`}
      >
        {comment.body}
      </p>
    </div>
  );
}

export function CommentThread({ complaintId, isClosed }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'shared' | 'internal'>('shared');

  const privileged = PRIVILEGED.some(r => user?.roles?.includes(r));
  const isAdmin = user?.roles?.includes('admin');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useComments(complaintId);
  const postComment = usePostComment(complaintId);
  const deleteComment = useDeleteComment(complaintId);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    const handler = ({ complaintId: cid }: { complaintId: string }) => {
      if (cid === complaintId) {
        qc.invalidateQueries({ queryKey: ['comments', complaintId] });
      }
    };
    socket.on('complaint.comment.added', handler);
    return () => { socket.off('complaint.comment.added', handler); };
  }, [complaintId, qc]);

  // Flatten all pages into a single array
  const allComments = data?.pages.flatMap(p => p.data) ?? [];
  const sharedComments = allComments.filter(c => !c.isInternal);
  const internalComments = allComments.filter(c => c.isInternal);
  const displayedComments = activeTab === 'internal' ? internalComments : sharedComments;

  const handleSubmit = (body: string) => {
    postComment.mutate(
      { body, isInternal: activeTab === 'internal' },
      { onError: () => toast.error('Failed to send message') },
    );
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId, {
      onError: () => toast.error('Failed to delete comment'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {privileged && (
        <div className="flex gap-1 border-b">
          {(['shared', 'internal'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'shared' ? 'Messages' : 'Internal Notes'}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {tab === 'shared' ? sharedComments.length : internalComments.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : displayedComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {activeTab === 'internal' ? 'No internal notes yet.' : 'No messages yet.'}
          </p>
        ) : (
          displayedComments.map(c => (
            <CommentBubble
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-xs text-muted-foreground underline"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}

      {/* Input */}
      <CommentInput
        onSubmit={handleSubmit}
        isPending={postComment.isPending}
        disabled={isClosed}
        disabledReason="Complaint is closed"
      />
    </div>
  );
}
