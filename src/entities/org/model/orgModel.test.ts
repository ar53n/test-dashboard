import { describe, expect, it } from 'vitest'
import { compareVersions, createOrgModel, pickCurrentModel } from './orgModel.ts'
import { makeNode } from './testUtils.ts'

const nodes = [makeNode('a', null)]

describe('compareVersions', () => {
  it('сравнивает ревизии только внутри одного epoch', () => {
    expect(compareVersions({ epoch: 'e1', revision: 5 }, { epoch: 'e1', revision: 5 })).toBe('same')
    expect(compareVersions({ epoch: 'e1', revision: 4 }, { epoch: 'e1', revision: 5 })).toBe('older')
    expect(compareVersions({ epoch: 'e1', revision: 6 }, { epoch: 'e1', revision: 5 })).toBe('newer')
    // после рестарта сервера тот же номер ревизии означает другое состояние
    expect(compareVersions({ epoch: 'e2', revision: 5 }, { epoch: 'e1', revision: 5 })).toBe('incomparable')
    expect(compareVersions(null, { epoch: 'e1', revision: 5 })).toBe('incomparable')
  })
})

describe('pickCurrentModel', () => {
  const current = createOrgModel(nodes, { epoch: 'e1', revision: 5 })

  it('оставляет модель из кэша для той же и более старой ревизии', () => {
    expect(pickCurrentModel(current, createOrgModel(nodes, { epoch: 'e1', revision: 5 }))).toBe(current)
    expect(pickCurrentModel(current, createOrgModel(nodes, { epoch: 'e1', revision: 3 }))).toBe(current)
  })

  it('принимает более новую ревизию, другой epoch и снимок без версии', () => {
    const newer = createOrgModel(nodes, { epoch: 'e1', revision: 6 })
    const restarted = createOrgModel(nodes, { epoch: 'e2', revision: 5 })
    const unversioned = createOrgModel(nodes, null)
    expect(pickCurrentModel(current, newer)).toBe(newer)
    expect(pickCurrentModel(current, restarted)).toBe(restarted)
    expect(pickCurrentModel(current, unversioned)).toBe(unversioned)
    expect(pickCurrentModel(undefined, newer)).toBe(newer)
  })
})
