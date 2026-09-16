// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildIndex } from '@/entities/org/model/buildIndex.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { getDefaultExpanded, useOrgTreeState, withAncestorsExpanded } from './useOrgTreeState.ts'

const index = buildIndex([
  makeNode('div', null),
  makeNode('dep', 'div'),
  makeNode('team', 'dep'),
  makeNode('group', 'team'),
  makeNode('leaf-div', null),
])

describe('раскрытие по умолчанию', () => {
  it('раскрывает узлы с детьми до второго уровня', () => {
    expect([...getDefaultExpanded(index)].sort()).toEqual(['dep', 'div'])
  })
})

describe('withAncestorsExpanded', () => {
  it('раскрывает всю цепочку предков, но не сам узел', () => {
    expect([...withAncestorsExpanded(index, new Set(), 'group')].sort()).toEqual(['dep', 'div', 'team'])
  })

  it('возвращает то же множество, если предки уже раскрыты', () => {
    const expanded = new Set(['div', 'dep', 'team'])
    expect(withAncestorsExpanded(index, expanded, 'group')).toBe(expanded)
    const roots = new Set<string>()
    expect(withAncestorsExpanded(index, roots, 'div')).toBe(roots)
  })
})

describe('useOrgTreeState', () => {
  it('до загрузки данных ничего не раскрыто, после — раскрыто по умолчанию', () => {
    const { result, rerender } = renderHook(({ idx }) => useOrgTreeState(idx), {
      initialProps: { idx: undefined as typeof index | undefined },
    })
    expect(result.current.expanded.size).toBe(0)
    rerender({ idx: index })
    expect(result.current.expanded.has('div')).toBe(true)
  })

  it('выбор узла раскрывает свёрнутых предков и каждый раз создаёт новый запрос прокрутки', () => {
    const { result } = renderHook(() => useOrgTreeState(index))

    act(() => result.current.toggle('div'))
    expect(result.current.expanded.has('div')).toBe(false)

    act(() => result.current.selectFromTable('group'))
    expect([...result.current.expanded].sort()).toEqual(['dep', 'div', 'team'])
    expect(result.current.selection).toEqual({ id: 'group', request: 1, source: 'table' })

    act(() => result.current.selectFromTable('group'))
    expect(result.current.selection).toEqual({ id: 'group', request: 2, source: 'table' })

    act(() => result.current.selectFromTree('group'))
    expect(result.current.selection).toEqual({ id: 'group', request: 3, source: 'tree' })
  })
})
