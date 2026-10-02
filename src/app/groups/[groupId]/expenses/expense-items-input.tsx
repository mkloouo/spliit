'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Currency } from '@/lib/currency'
import { ExpenseFormInput } from '@/lib/schemas'
import { cn, formatCurrency } from '@/lib/utils'
import { Plus, Users, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

type Item = NonNullable<ExpenseFormInput['items']>[number]

/**
 * One row's columns, shared by the item rows, the header and the total so the
 * three line up. A narrow screen gives the title a line of its own — item
 * names are long enough that sharing one with the amount truncates most of
 * them — while the delete button keeps a column of its own at both widths, so
 * the amounts stay in one column to read down.
 */
const ROW =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_11rem_7rem_2rem] gap-2 sm:gap-3 items-center'

/**
 * A field that stays out of the way until it is pointed at. Four boxed inputs
 * per row turn a scanned receipt into a wall of borders; these draw one only
 * on hover or focus.
 */
const QUIET_FIELD =
  'h-9 border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-input'

/**
 * Where a row sits. A line with a negative amount is an adjustment — a rebate,
 * a coupon — and belongs under the items it comes off, below its own heading.
 * This is CSS `order` rather than a sorted list on purpose: typing a minus into
 * an amount moves its row, and moving the input in the DOM would take the focus
 * out of the field being typed into.
 */
const ORDER = {
  header: 0,
  item: 1,
  adjustmentsHeading: 2,
  adjustment: 3,
  total: 4,
}

const isAdjustment = (item: Item) => Number(item.amount) < 0

/**
 * The lines an expense is made up of: what each one was, what it cost, and who
 * shares it. Entered by hand or filled in from a scanned receipt.
 *
 * The component only edits the list; deriving the split from it is the form's
 * job (see `itemisedShares`).
 */
export function ExpenseItemsInput({
  items,
  updateItems,
  participants,
  currency,
  /** Formats a typed amount the way the rest of the form does. */
  enforceCurrencyPattern,
  newItemId,
  /** What the items add up to, in minor units. */
  total,
  /** Offered only when the items do not add up to the expense amount. */
  onUseAsAmount,
}: {
  items: Item[]
  updateItems: (items: Item[]) => void
  participants: { id: string; name: string }[]
  currency: Currency
  enforceCurrencyPattern: (value: string) => string
  newItemId: () => string
  total: number
  onUseAsAmount?: () => void
}) {
  const t = useTranslations('ExpenseForm.ItemsField')
  const locale = useLocale()

  const replace = (index: number, item: Item) =>
    updateItems(items.map((existing, i) => (i === index ? item : existing)))

  const hasAdjustments = items.some(isAdjustment)

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col">
          <div
            style={{ order: ORDER.header }}
            className={cn(
              ROW,
              'hidden sm:grid pb-2 border-b text-xs font-medium uppercase tracking-wide text-muted-foreground',
            )}
          >
            <div className="px-3">{t('itemColumn')}</div>
            <div className="px-3">{t('forWhom')}</div>
            <div className="px-3 text-right">{t('amountColumn')}</div>
            <div />
          </div>

          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                order: isAdjustment(item) ? ORDER.adjustment : ORDER.item,
              }}
              className={cn(ROW, 'py-1 border-b border-border/60')}
            >
              <Input
                className={cn(
                  QUIET_FIELD,
                  'text-base sm:text-sm col-span-3 sm:col-span-1',
                )}
                maxLength={200}
                placeholder={t('titlePlaceholder')}
                value={item.title}
                onChange={(event) =>
                  replace(index, { ...item, title: event.target.value })
                }
              />
              <ItemParticipants
                participants={participants}
                selected={item.participants ?? []}
                onChange={(selected) =>
                  replace(index, { ...item, participants: selected })
                }
              />
              <Input
                className={cn(
                  QUIET_FIELD,
                  'text-base sm:text-sm w-[5.5rem] sm:w-full text-right tabular-nums',
                  isAdjustment(item) && 'text-amber-700 dark:text-amber-500',
                )}
                type="text"
                inputMode="decimal"
                step={10 ** -currency.decimal_digits}
                value={item.amount as string | number}
                onChange={(event) =>
                  replace(index, {
                    ...item,
                    amount: enforceCurrencyPattern(event.target.value),
                  })
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground"
                title={t('remove')}
                onClick={() => updateItems(items.filter((_, i) => i !== index))}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {hasAdjustments && (
            <div
              style={{ order: ORDER.adjustmentsHeading }}
              className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {t('adjustments')}
            </div>
          )}

          <div style={{ order: ORDER.total }} className={cn(ROW, 'pt-3')}>
            <span className="px-3 text-sm text-muted-foreground">
              {t('total')}
            </span>
            <span className="hidden sm:block" />
            <span className="px-3 text-sm font-semibold text-right tabular-nums">
              {formatCurrency(currency, total, locale)}
            </span>
            <span className="w-8 sm:w-auto" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() =>
            updateItems([
              ...items,
              { id: newItemId(), title: '', amount: '', participants: [] },
            ])
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('add')}
        </Button>
        {onUseAsAmount && (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={onUseAsAmount}
          >
            {t('useAsAmount')}
          </Button>
        )}
      </div>
    </div>
  )
}

function ItemParticipants({
  participants,
  selected,
  onChange,
}: {
  participants: { id: string; name: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const t = useTranslations('ExpenseForm.ItemsField')
  const names = participants
    .filter(({ id }) => selected.includes(id))
    .map(({ name }) => name)

  const label =
    names.length === 0
      ? t('nobody')
      : names.length === participants.length
        ? t('everyone')
        : names.join(', ')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            // A pill on a phone, where there is no hover to reveal an outline;
            // as quiet as the fields beside it once the column has room.
            'h-9 w-full justify-start font-normal rounded-full',
            'sm:rounded-md sm:border-transparent sm:bg-transparent sm:shadow-none sm:hover:border-input',
            names.length === 0 && 'text-muted-foreground',
          )}
          title={t('forWhom')}
        >
          <Users className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="flex justify-between items-center px-2 pb-1">
          <span className="text-sm font-medium">{t('forWhom')}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="-mr-2"
            onClick={() =>
              onChange(
                selected.length === participants.length
                  ? []
                  : participants.map(({ id }) => id),
              )
            }
          >
            {selected.length === participants.length
              ? t('selectNone')
              : t('selectAll')}
          </Button>
        </div>
        {participants.map(({ id, name }) => (
          <label
            key={id}
            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, id]
                    : selected.filter((value) => value !== id),
                )
              }
            />
            <span className="flex-1">{name}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}
