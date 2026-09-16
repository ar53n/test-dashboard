// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPatch } from '@/entities/org/model/applyPatch.ts'
import { createOrgModel, type OrgModel } from '@/entities/org/model/orgModel.ts'
import { makeNode } from '@/entities/org/model/testUtils.ts'
import { renderWithTheme } from '@/shared/ui/renderWithTheme.ts'
import { OrgTree } from './OrgTree.tsx'

const model = createOrgModel(
  [makeNode('tech', null, { name: 'Технологии', headcount: 1 }), makeNode('platform', 'tech', { name: 'Платформа' })],
  { epoch: 'e1', revision: 0 },
)

const noop = () => {}

function Tree({ data }: { data: OrgModel }) {
  return (
    <OrgTree
      model={data}
      expanded={new Set(['tech'])}
      animate={false}
      onToggle={noop}
      onSelect={noop}
      selection={null}
    />
  )
}

/** Названия узлов, на которых сейчас есть подсветка. */
const flashedNames = () =>
  Array.from(document.querySelectorAll('[data-node-id] button:not([aria-expanded]) > :first-child'))
    .filter((name) => name.querySelector(':scope > [aria-hidden="true"]'))
    .map((name) => name.textContent)

afterEach(cleanup)

describe('OrgTree: live-обновления', () => {
  it('подсвечивает изменённое название; первый рендер не подсвечивается', () => {
    const { rerender } = renderWithTheme(<Tree data={model} />)
    expect(flashedNames()).toEqual([])

    rerender(
      <Tree
        data={applyPatch(model, {
          type: 'patch',
          epoch: 'e1',
          revision: 1,
          changes: [{ id: 'platform', name: 'Платформа 2.0', updatedAt: '2026-09-15T10:00:00.000Z' }],
        })}
      />,
    )
    expect(flashedNames()).toEqual(['Платформа 2.0'])
  })
})
