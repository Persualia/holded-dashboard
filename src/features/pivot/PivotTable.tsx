import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { EditableAmount } from '@/components/sim/EditableAmount';
import { GROUP_ORDER } from '@/lib/categorize';
import { CURRENT_MONTH_IDX, MONTH_LABELS_ES, isLocked, monthState } from '@/lib/time';
import { formatEUR } from '@/lib/format';
import type { Dataset, EffectiveItem, ItemType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  items: EffectiveItem[];
  base: Dataset;
  collapsedGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  onOverride: (account: string, monthIdx: number, value: number | null) => void;
  onFillRight: (account: string, fromMonthIdx: number, value: number, offset: number) => boolean;
  onAddSimRow: (group: string, type: ItemType) => string;
  onRenameSimRow: (id: string, name: string) => void;
  onDeleteSimRow: (id: string) => void;
}

interface GroupBucket {
  type: 'income' | 'expense';
  items: EffectiveItem[];
  totals: number[];
}

const stickyCol =
  'sticky left-0 z-10 bg-background border-r whitespace-nowrap min-w-[180px] max-w-[220px]';
const stickyHeadCol = 'sticky left-0 z-20 bg-muted border-r min-w-[180px] max-w-[220px]';

export function PivotTable({
  items,
  base,
  collapsedGroups,
  onToggleGroup,
  onOverride,
  onFillRight,
  onAddSimRow,
  onRenameSimRow,
  onDeleteSimRow,
}: Props) {
  const [focusRowId, setFocusRowId] = useState<string | null>(null);

  function handleAddSimRow(group: string, type: ItemType) {
    const id = onAddSimRow(group, type);
    setFocusRowId(id);
  }

  const groups: Record<string, GroupBucket> = {};
  for (const it of items) {
    const g = (groups[it.group] ??= {
      type: it.type,
      items: [],
      totals: new Array(12).fill(0),
    });
    g.items.push(it);
    for (let m = 0; m < 12; m++) g.totals[m] += it.values[m] ?? 0;
  }
  const orderedGroups = GROUP_ORDER.filter((g) => groups[g]);
  const overall = new Array(12).fill(0);
  for (const it of items) for (let m = 0; m < 12; m++) overall[m] += it.values[m] ?? 0;

  return (
    <div className="overflow-auto rounded-lg border bg-background" style={{ maxHeight: 620 }}>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted">
          <tr className="sticky top-0 z-30 bg-muted">
            <th className={cn(stickyHeadCol, 'px-3 py-2 text-left text-xs font-medium')}>Concepto</th>
            {MONTH_LABELS_ES.map((l, i) => {
              const st = monthState(i);
              return (
                <th
                  key={l}
                  className={cn(
                    'whitespace-nowrap px-2 py-2 text-right text-xs font-medium',
                    st === 'past' && 'bg-muted/80 text-muted-foreground/80',
                    st === 'current' && 'bg-success/10 text-success',
                  )}
                >
                  {l}
                </th>
              );
            })}
            <th className="whitespace-nowrap border-l px-2 py-2 text-right text-xs font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {orderedGroups.map((g) => {
            const G = groups[g];
            const collapsed = collapsedGroups.has(g);
            const groupTotal = G.totals.reduce((a, b) => a + b, 0);
            return (
              <GroupRows
                key={g}
                group={g}
                bucket={G}
                groupTotal={groupTotal}
                collapsed={collapsed}
                onToggleGroup={onToggleGroup}
                base={base}
                onOverride={onOverride}
                onFillRight={onFillRight}
                onAddSimRow={handleAddSimRow}
                onRenameSimRow={onRenameSimRow}
                onDeleteSimRow={onDeleteSimRow}
                focusRowId={focusRowId}
                onFocusConsumed={() => setFocusRowId(null)}
              />
            );
          })}
          <tr className="border-t-2 bg-muted/40 font-semibold">
            <td className={cn(stickyCol, 'bg-muted/40 px-3 py-2 text-xs')}>Total filtrado</td>
            {overall.map((v, i) => (
              <td
                key={i}
                className={cn(
                  'whitespace-nowrap px-2 py-1.5 text-right tabular-nums',
                  v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {formatEUR(v, { compact: true })}
              </td>
            ))}
            <td className="whitespace-nowrap border-l px-2 py-1.5 text-right tabular-nums">
              {formatEUR(overall.reduce((a, b) => a + b, 0), { compact: true })}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface GroupRowsProps {
  group: string;
  bucket: GroupBucket;
  groupTotal: number;
  collapsed: boolean;
  onToggleGroup: (g: string) => void;
  base: Dataset;
  onOverride: (account: string, monthIdx: number, value: number | null) => void;
  onFillRight: (account: string, fromMonthIdx: number, value: number, offset: number) => boolean;
  onAddSimRow: (group: string, type: ItemType) => void;
  onRenameSimRow: (id: string, name: string) => void;
  onDeleteSimRow: (id: string) => void;
  focusRowId: string | null;
  onFocusConsumed: () => void;
}

function GroupRows({
  group,
  bucket,
  groupTotal,
  collapsed,
  onToggleGroup,
  base,
  onOverride,
  onFillRight,
  onAddSimRow,
  onRenameSimRow,
  onDeleteSimRow,
  focusRowId,
  onFocusConsumed,
}: GroupRowsProps) {
  return (
    <>
      <tr
        className="group/row cursor-pointer border-t bg-secondary/40 hover:bg-secondary"
        onClick={() => onToggleGroup(group)}
      >
        <td className={cn(stickyCol, 'bg-secondary/40 px-3 py-2 font-medium')}>
          <span className="flex items-center gap-1.5">
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {group}
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              · {bucket.items.length}
            </span>
            <button
              type="button"
              aria-label={`Añadir fila simulada en ${group}`}
              title="Añadir fila de simulación"
              onClick={(e) => {
                e.stopPropagation();
                if (collapsed) onToggleGroup(group);
                onAddSimRow(group, bucket.type);
              }}
              className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm text-primary opacity-0 transition-opacity hover:bg-primary/10 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary group-hover/row:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
        {bucket.totals.map((v, i) => (
          <td
            key={i}
            className={cn(
              'whitespace-nowrap px-2 py-1.5 text-right tabular-nums',
              v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {v === 0 ? '—' : formatEUR(v, { compact: true })}
          </td>
        ))}
        <td
          className={cn(
            'whitespace-nowrap border-l px-2 py-1.5 text-right font-semibold tabular-nums',
            groupTotal < 0 ? 'text-destructive' : 'text-success',
          )}
        >
          {formatEUR(groupTotal, { compact: true })}
        </td>
      </tr>
      {!collapsed &&
        bucket.items.map((it) => {
          const total = it.values.reduce((a, b) => a + b, 0);
          return (
            <tr key={it.account} className="border-t hover:bg-muted/30">
              <td
                className={cn(stickyCol, 'px-3 py-1.5')}
                title={
                  it.isSimRow
                    ? `Simulación · click para renombrar · Alt+click para eliminar`
                    : `${it.account} · ${it.name}`
                }
              >
                {it.isSimRow ? (
                  <SimRowName
                    id={it.account}
                    name={it.name}
                    autoFocus={focusRowId === it.account}
                    onAutoFocusConsumed={onFocusConsumed}
                    onRename={(n) => onRenameSimRow(it.account, n)}
                    onDelete={() => onDeleteSimRow(it.account)}
                  />
                ) : (
                  <span className="block truncate text-xs">{it.name}</span>
                )}
              </td>
              {it.values.map((v, m) => {
                const isSim = it.simMask[m];
                const orig = base.items.find((b) => b.account === it.account)?.values[m] ?? v;
                const locked = isLocked(m);
                const st = monthState(m);
                return (
                  <td
                    key={m}
                    className={cn(
                      'whitespace-nowrap px-2 py-1.5 text-right tabular-nums',
                      v < 0 ? 'text-destructive' : v > 0 ? 'text-foreground' : 'text-muted-foreground',
                      st === 'past' && !isSim && 'bg-muted/20',
                      st === 'current' && !isSim && 'bg-success/5',
                      m === CURRENT_MONTH_IDX && 'border-l border-success/30',
                    )}
                  >
                    <EditableAmount
                      value={v}
                      original={orig}
                      isSim={isSim}
                      locked={locked}
                      onChange={(nv) => onOverride(it.account, m, nv)}
                      onFillRight={(nv, offset) => onFillRight(it.account, m, nv, offset)}
                    />
                  </td>
                );
              })}
              <td className="whitespace-nowrap border-l px-2 py-1.5 text-right tabular-nums">
                {formatEUR(total, { compact: true })}
              </td>
            </tr>
          );
        })}
    </>
  );
}

interface SimRowNameProps {
  id: string;
  name: string;
  autoFocus: boolean;
  onAutoFocusConsumed: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function SimRowName({ id, name, autoFocus, onAutoFocusConsumed, onRename, onDelete }: SimRowNameProps) {
  const [editing, setEditing] = useState(autoFocus);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setEditing(true);
      setDraft(name);
      onAutoFocusConsumed();
    }
    // We only want to react when the parent flips this row's autoFocus on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, id]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() !== name) onRename(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(name);
            setEditing(false);
          }
        }}
        className="w-full rounded-full border border-primary bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        if (e.altKey) {
          e.preventDefault();
          onDelete();
          return;
        }
        setEditing(true);
      }}
      className="inline-block max-w-full cursor-text truncate rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
    >
      {name}
    </span>
  );
}
