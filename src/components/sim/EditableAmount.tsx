import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEUR, parseUserNumber } from '@/lib/format';

interface EditableAmountProps {
  value: number;
  original: number;
  isSim: boolean;
  locked: boolean;
  onChange: (value: number | null) => void;
  /**
   * When provided, Shift+ArrowRight inside the input writes the value into the
   * cell `offset` positions to the right (offset starts at 1 and grows on each
   * subsequent Shift+ArrowRight). Returns false if the target is out of range
   * or locked, so the editor knows not to advance the offset.
   */
  onFillRight?: (value: number, offset: number) => boolean;
  compact?: boolean;
  /** Visual emphasis (e.g. larger text in timeline). */
  className?: string;
}

/**
 * Numeric cell that turns into an inline input on double-click.
 * Alt+click resets to the original value.
 * If `locked` (past month), edits are rejected and the cell renders muted.
 */
export function EditableAmount({
  value,
  original,
  isSim,
  locked,
  onChange,
  onFillRight,
  compact = true,
  className,
}: EditableAmountProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const fillOffsetRef = useRef(0);

  function commit() {
    const n = parseUserNumber(draft);
    if (n != null && n !== value) onChange(n);
    setEditing(false);
  }

  if (editing && !locked) {
    return (
      <input
        autoFocus
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            return;
          }
          if (e.key === 'Escape') {
            setEditing(false);
            return;
          }
          if (e.key === 'ArrowRight' && e.shiftKey && onFillRight) {
            e.preventDefault();
            const n = parseUserNumber(draft);
            if (n == null) return;
            // First press also commits the current cell so it picks up the value.
            if (fillOffsetRef.current === 0 && n !== value) onChange(n);
            const nextOffset = fillOffsetRef.current + 1;
            const ok = onFillRight(n, nextOffset);
            if (ok) fillOffsetRef.current = nextOffset;
          }
        }}
        className="w-20 rounded-sm border border-primary bg-background px-1 text-right text-xs font-medium tabular-nums shadow-sm focus:outline-none"
      />
    );
  }

  const display = value === 0 ? '—' : formatEUR(value, { compact });

  return (
    <span
      onDoubleClick={() => {
        if (locked) return;
        setDraft(String(value || 0));
        fillOffsetRef.current = 0;
        setEditing(true);
      }}
      onClick={(e) => {
        if (locked) return;
        if (e.altKey) onChange(null);
      }}
      title={
        locked
          ? 'Mes cerrado — no editable'
          : isSim
          ? `Original: ${formatEUR(original)} · Doble click para editar${
              onFillRight ? ' · Shift+→ para extender a la derecha' : ''
            } · Alt+click para reset`
          : `Doble click para simular${
              onFillRight ? ' · Shift+→ para extender a la derecha' : ''
            } · Alt+click para reset`
      }
      className={cn(
        'inline-flex items-center justify-end gap-1 rounded-sm px-1 transition-colors',
        locked && 'cursor-not-allowed text-muted-foreground/70',
        !locked && 'cursor-text hover:bg-muted/60',
        isSim && 'rounded-full bg-primary px-2 font-medium text-primary-foreground shadow-sm',
        className,
      )}
    >
      {locked && value === 0 ? <Lock className="h-2.5 w-2.5 opacity-40" /> : null}
      {display}
    </span>
  );
}
