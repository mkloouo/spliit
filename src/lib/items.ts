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
