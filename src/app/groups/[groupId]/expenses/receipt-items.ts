/**
 * The hand-off of scanned line items from the receipt dialog to the expense
 * form it navigates to.
 *
 * The scalar fields travel in the query string, but a receipt can carry dozens
 * of items; `sessionStorage` keeps the URL readable and the payload bounded to
 * the tab that produced it.
 */

const KEY = 'spliit-receipt-items'

export type ReceiptItem = { title: string; amount: number }

export function stashReceiptItems(items: ReceiptItem[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // A private window or a full quota: the expense is still created, just
    // without its items.
  }
}

/**
 * The items the receipt dialog left behind, removing them as they are read so
 * a later visit to the create form starts empty.
 */
export function takeReceiptItems(): ReceiptItem[] {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ReceiptItem => {
      if (!item || typeof item !== 'object') return false
      const { title, amount } = item as Partial<ReceiptItem>
      return (
        typeof title === 'string' &&
        typeof amount === 'number' &&
        Number.isFinite(amount)
      )
    })
  } catch {
    return []
  }
}
