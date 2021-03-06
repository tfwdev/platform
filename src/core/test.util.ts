import {BitSet, filteredIterable, insertSorted} from "./util"

test("bitset", () => {
  const b = new BitSet()

  for (let ii = 0; ii < 1024; ii += 2) expect(b.add(ii)).toBe(true)
  for (let ii = 0; ii < 1024; ii += 1) expect(b.has(ii)).toBe(ii%2 === 0)

  let seen = 0
  b.forEach(v => { expect(v%2).toBe(0) ; seen += 1 })
  expect(seen).toBe(1024/2)

  for (let ii = 0; ii < 1024; ii += 1) expect(b.delete(ii)).toBe(ii%2 == 0)
  for (let ii = 0; ii < 1024; ii += 1) expect(b.has(ii)).toBe(false)

  for (let ii = 1; ii < 1024; ii += 2) expect(b.add(ii)).toBe(true)
  for (let ii = 0; ii < 1024; ii += 1) expect(b.has(ii)).toBe(ii%2 !== 0)

  expect(b.find(v => v > 1000)).toBe(1001)
  expect(b.find(v => v == 1000)).toBe(-1)
})

test("filter", () => {
  const nums = [1, 2, 3, 4, 5, 6]
  expect(Array.from(filteredIterable(nums, n => n % 2 == 0))).toEqual([2, 4, 6])
})

test("insertSorted", () => {
  const cmp = (a :number, b :number) => a-b
  for (let ii = 0; ii < 100; ii += 1) {
    const sort :number[] = [], sorted :number[] = []
    for (let cc = 0; cc < 1000; cc += 1) {
      const v = Math.round(Math.random()*10000)
      sort.push(v)
      insertSorted(sorted, v, cmp)
    }
    sort.sort(cmp)
    expect(sorted).toEqual(sort)
  }
})
