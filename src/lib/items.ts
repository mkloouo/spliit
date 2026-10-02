import { distributeAmount } from './shares'

/**
 * Turns an itemised expense into a `BY_AMOUNT` split: what each participant
 * owes, given the items they share.
 *
 * Each item's price is split evenly between the participants assigned to it.
 * Whatever the assigned items do not account for — tax, a tip, a discount, or
 * an item nobody claimed — is then shared evenly between everyone who claimed
 * something, so the shares always add up to exactly `amount`.
 *
 * Everything is in minor units.
 *
 * @returns the amount owed per participant id, or `null` when no item has been
 * assigned to anyone and there is therefore no split to derive.
 */
export function itemisedShares(
  amount: number,
  items: { amount: number; participants: string[] }[],
): Map<string, number> | null {
  const owed = new Map<string, number>()
  let claimed = 0

  for (const item of items) {
    if (item.participants.length === 0) continue
    claimed += item.amount
    // Even within one item the price rarely divides exactly; apportioning it
    // keeps the item's own parts adding up to its price.
    distributeAmount(item.amount, item.participants.length).forEach(
      (part, index) => {
        const id = item.participants[index]
        owed.set(id, (owed.get(id) ?? 0) + part)
      },
    )
  }

  const ids = [...owed.keys()]
  if (ids.length === 0) return null

  distributeAmount(amount - claimed, ids.length).forEach((part, index) => {
    const id = ids[index]
    owed.set(id, owed.get(id)! + part)
  })

  return owed
}

/**
 * The one item whose removal would make the rest add up to `amount`, or null
 * when no single item explains the difference.
 *
 * A receipt prints summary lines — a total of all discounts, a subtotal — that
 * restate figures from the lines above them. Read as items, they are counted
 * twice and the list no longer agrees with what was paid. The prompt asks the
 * model to leave them out; this catches the ones that slip through, by
 * arithmetic rather than by matching words, so it works whatever language the
 * receipt is printed in.
 *
 * Everything is in minor units.
 */
export function findRedundantItem<T extends { amount: number }>(
  amount: number,
  items: T[],
): T | null {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  if (total === amount) return null

  // Every candidate necessarily holds the same amount — `total - amount` — so
  // removing any one of them leaves the same, correct list. Which to name is
  // the only choice, and the last is the better guess: a receipt prints a
  // summary after the lines it summarises, as `Opusty łącznie` follows the
  // per-line rebate it repeats.
  return items.findLast((item) => total - item.amount === amount) ?? null
}
