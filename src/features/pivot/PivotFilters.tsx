import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { ItemType } from '@/lib/types';

export type FilterType = 'all' | ItemType;

interface Props {
  search: string;
  onSearch: (s: string) => void;
  type: FilterType;
  onType: (t: FilterType) => void;
  /** Null = all groups enabled (default). */
  enabledGroups: Set<string> | null;
  onToggleGroup: (group: string, on: boolean) => void;
  onResetGroups: () => void;
  allGroups: string[];
  activeOnly: boolean;
  onActiveOnly: (b: boolean) => void;
  totalRows: number;
  matchingRows: number;
}

export function PivotFilters({
  search,
  onSearch,
  type,
  onType,
  enabledGroups,
  onToggleGroup,
  onResetGroups,
  allGroups,
  activeOnly,
  onActiveOnly,
  totalRows,
  matchingRows,
}: Props) {
  return (
    <Card className="sticky top-4 self-start">
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
        <p className="text-xs text-muted-foreground">
          {matchingRows} / {totalRows} filas
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Buscar</Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="cliente, cuenta…"
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {(
              [
                ['all', 'Todo'],
                ['income', 'Ingresos'],
                ['expense', 'Gastos'],
              ] as const
            ).map(([v, l]) => (
              <Button
                key={v}
                size="sm"
                variant={type === v ? 'default' : 'outline'}
                onClick={() => onType(v)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Categorías
            </Label>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onResetGroups}>
              todas
            </Button>
          </div>
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {allGroups.map((g) => {
              const checked = enabledGroups === null ? true : enabledGroups.has(g);
              return (
                <li key={g} className="flex items-center gap-2">
                  <Checkbox
                    id={`grp-${g}`}
                    checked={checked}
                    onCheckedChange={(v) => onToggleGroup(g, Boolean(v))}
                  />
                  <Label htmlFor={`grp-${g}`} className="cursor-pointer text-xs font-normal">
                    {g}
                  </Label>
                </li>
              );
            })}
          </ul>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Checkbox
            id="active-only"
            checked={activeOnly}
            onCheckedChange={(v) => onActiveOnly(Boolean(v))}
          />
          <Label htmlFor="active-only" className="cursor-pointer text-xs font-normal">
            Solo filas con valor
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
