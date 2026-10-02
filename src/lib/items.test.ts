import { itemisedShares } from './items'

const shares = (
  amount: number,
  items: { amount: number; participants: string[] }[],
) => {
  const result = itemisedShares(amount, items)
  return result && Object.fromEntries(result)
}

describe('itemisedShares', () => {
  it('gives each participant the items they alone claimed', () => {
    expect(
      shares(3000, [
        { amount: 2000, participants: ['alice'] },
        { amount: 1000, participants: ['bob'] },
      ]),
    ).toEqual({ alice: 2000, bob: 1000 })
  })

  it('splits a shared item between the participants who claimed it', () => {
    expect(
      shares(1000, [{ amount: 1000, participants: ['alice', 'bob'] }]),
    ).toEqual({ alice: 500, bob: 500 })
  })

  it('splits an item that does not divide exactly, without losing a unit', () => {
    expect(
      shares(1000, [{ amount: 1000, participants: ['alice', 'bob', 'carol'] }]),
    ).toEqual({ alice: 334, bob: 333, carol: 333 })
  })

  it('shares tax and tips the items do not account for', () => {
    // 30.00 of items, 36.00 charged: 6.00 of service split evenly.
    expect(
      shares(3600, [
        { amount: 2000, participants: ['alice'] },
        { amount: 1000, participants: ['bob'] },
      ]),
    ).toEqual({ alice: 2300, bob: 1300 })
  })

  it('shares a discount the same way', () => {
    expect(
      shares(2800, [
        { amount: 2000, participants: ['alice'] },
        { amount: 1000, participants: ['bob'] },
      ]),
    ).toEqual({ alice: 1900, bob: 900 })
  })

  it('shares an item nobody claimed between those who claimed something', () => {
    expect(
      shares(3000, [
        { amount: 2000, participants: ['alice'] },
        { amount: 1000, participants: [] },
      ]),
    ).toEqual({ alice: 3000 })
  })

  it('always adds up to the expense amount, to the minor unit', () => {
    const items = [
      { amount: 999, participants: ['alice', 'bob', 'carol'] },
      { amount: 101, participants: ['bob', 'carol'] },
      { amount: 50, participants: ['carol'] },
    ]
    for (const amount of [0, 1, 1149, 1150, 1151, 2000, -500]) {
      const result = itemisedShares(amount, items)!
      expect([...result.values()].reduce((sum, v) => sum + v, 0)).toBe(amount)
    }
  })

  it('has no split to derive when nothing was claimed', () => {
    expect(shares(1000, [])).toBeNull()
    expect(shares(1000, [{ amount: 1000, participants: [] }])).toBeNull()
  })
})
