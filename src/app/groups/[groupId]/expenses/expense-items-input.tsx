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
import { cn } from '@/lib/utils'
import { Plus, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Item = NonNullable<ExpenseFormInput['items']>[number]

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
}: {
  items: Item[]
  updateItems: (items: Item[]) => void
  participants: { id: string; name: string }[]
  currency: Currency
  enforceCurrencyPattern: (value: string) => string
  newItemId: () => string
}) {
  const t = useTranslations('ExpenseForm.ItemsField')

  const replace = (index: number, item: Item) =>
    updateItems(items.map((existing, i) => (i === index ? item : existing)))

  return (
    <div>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      )}
      {items.map((item, index) => (
        // On a phone the title gets a line of its own — item names are long
        // enough that sharing one with the amount truncates most of them — and
        // the three narrow controls share the line below it. From `sm` up it is
        // all one row.
        <div
          key={item.id}
          className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-2 items-center border-t last-of-type:border-b -mx-6 px-6 py-2"
        >
          <Input
            className="text-base col-span-2 sm:col-span-1 sm:-my-2 sm:min-w-[140px]"
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
          <div className="flex gap-1 items-center sm:-my-2">
            <span className="text-sm">{currency.symbol}</span>
            <Input
              className="text-base w-[90px]"
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
              className="shrink-0"
              title={t('remove')}
              onClick={() => updateItems(items.filter((_, i) => i !== index))}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-4"
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
            // Fills its cell on the phone layout, stays compact next to the
            // title on a wide one.
            'h-10 w-full justify-start font-normal sm:-my-2 sm:w-auto sm:max-w-[160px]',
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
