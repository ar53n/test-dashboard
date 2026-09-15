import { describe, expect, it } from 'vitest'
import { buildIndex, OrgStructureError } from './buildIndex.ts'
import { makeNode } from './testUtils.ts'

describe('buildIndex', () => {
  it('строит корни, детей и глубину из плоского массива в произвольном порядке', () => {
    const index = buildIndex([
      makeNode('team', 'dep'),
      makeNode('div', null),
      makeNode('dep', 'div'),
      makeNode('div-2', null),
    ])

    expect(index.roots).toEqual(['div', 'div-2'])
    expect(index.children.get('div')).toEqual(['dep'])
    expect(index.children.get('dep')).toEqual(['team'])
    expect(index.depth.get('div')).toBe(0)
    expect(index.depth.get('team')).toBe(2)
    expect(index.topDownOrder.indexOf('dep')).toBeLessThan(index.topDownOrder.indexOf('team'))
  })

  it('принимает пустой массив', () => {
    const index = buildIndex([])
    expect(index.nodes.size).toBe(0)
    expect(index.roots).toEqual([])
  })

  it('отклоняет дубликаты id', () => {
    expect(() => buildIndex([makeNode('a', null), makeNode('a', null)])).toThrow(OrgStructureError)
  })

  it('отклоняет ссылку на несуществующего родителя', () => {
    expect(() => buildIndex([makeNode('a', 'ghost')])).toThrow(/несуществующего родителя/)
  })

  it('отклоняет циклы, включая узел-сам-себе-родитель', () => {
    expect(() => buildIndex([makeNode('root', null), makeNode('a', 'b'), makeNode('b', 'a')])).toThrow(/Цикл/)
    expect(() => buildIndex([makeNode('self', 'self')])).toThrow(/Цикл/)
  })
})
