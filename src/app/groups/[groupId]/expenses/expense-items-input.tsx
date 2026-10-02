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
        <div
          key={item.id}
          className="flex flex-wrap gap-2 items-center border-t last-of-type:border-b -mx-6 px-6 py-2"
        >
          <Input
            className="text-base flex-1 min-w-[140px] -my-2"
            maxLength={200}
            placeholder={t('titlePlaceholder')}
            value={item.title}
            onChange={(event) =>
              replace(index, { ...item, title: event.target.value })
            }
          />
          <div className="flex gap-1 items-center">
            <span className="text-sm">{currency.symbol}</span>
            <Input
              className="text-base w-[90px] -my-2"
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
          </div>
          <ItemParticipants
            participants={participants}
            selected={item.participants ?? []}
            onChange={(selected) =>
              replace(index, { ...item, participants: selected })
            }
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-my-2"
            title={t('remove')}
            onClick={() => updateItems(items.filter((_, i) => i !== index))}
          >
            <X className="w-4 h-4" />
          </Button>
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
            'max-w-[160px] -my-2 font-normal',
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
