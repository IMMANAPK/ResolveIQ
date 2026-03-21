import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (body: string) => void;
  isPending: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX = 2000;

export function CommentInput({ onSubmit, isPending, disabled, disabledReason }: Props) {
  const [body, setBody] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={disabled ? disabledReason : 'Write a message…'}
          rows={3}
          maxLength={MAX}
          disabled={disabled || isPending}
          className="resize-none"
        />
        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {body.length}/{MAX}
        </span>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={!body.trim() || isPending || disabled}
      >
        {isPending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
