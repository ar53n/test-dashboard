# Модель данных

## Контракт API

`GET /api/org-tree` возвращает плоский массив:

```ts
interface OrgNode {
  id: string
  name: string
  parentId: string | null // null — корень (дивизион)
  headcount: number       // целое ≥ 0, сотрудники самого узла
  budget: number          // ≥ 0, бюджет самого узла, руб.
  performance: number     // 0–100
  updatedAt: string       // ISO 8601
}
```

Заголовки ответа:

| Заголовок | Значение |
| --- | --- |
| `ETag` | `"<epoch>-<revision>"` |
| `X-Org-Epoch` | id запуска сервера |
| `X-Org-Revision` | номер ревизии внутри epoch |
| `Cache-Control` | `no-cache` |

Если `If-None-Match` совпадает с текущим ETag, сервер отвечает `304 Not Modified` без тела.

### Версия состояния

Версия — пара `(epoch, revision)`. Состояние сервера живёт в памяти, поэтому после рестарта номер ревизии начинается заново: `rev-5` до и после рестарта — разные данные. `epoch` (UUID при старте процесса) делает пару уникальной. Ревизии сравниваются только при совпадающем epoch; разные epoch несравнимы, и клиент принимает новый снимок.

## Дерево на клиенте

Плоский массив превращается в индекс за O(n) (`src/entities/org/model/buildIndex.ts`):

```ts
interface OrgIndex {
  nodes: ReadonlyMap<string, OrgNode>
  children: ReadonlyMap<string, readonly string[]>
  roots: readonly string[]
  depth: ReadonlyMap<string, number>   // 0 — дивизион, 1 — отдел, 2 — команда
  topDownOrder: readonly string[]      // обход в ширину от корней
}
```

`Map`, а не объект: id приходят с сервера, и ключ вроде `__proto__` не должен ломать индекс.

Проверки при построении (нарушение → ошибка валидации, данные не показываются):

1. уникальность `id`;
2. `parentId` ссылается на существующий узел;
3. все узлы достижимы от корней. Раз все родители существуют, недостижимый узел может быть только в цикле, поэтому отдельный поиск циклов не нужен.

## Алгоритм агрегации

`src/entities/org/model/aggregate.ts`.

```ts
interface Aggregate {
  totalHeadcount: number        // узел + все потомки
  totalBudget: number           // узел + все потомки
  perfWeightSum: number         // Σ performance × headcount по поддереву
  avgPerformance: number | null // perfWeightSum / totalHeadcount; null, если сотрудников нет
}
```

Агрегат узла выражается через его собственные значения и агрегаты детей:

```
agg(n).totalHeadcount = n.headcount + Σ agg(c).totalHeadcount
agg(n).totalBudget    = n.budget    + Σ agg(c).totalBudget
agg(n).perfWeightSum  = n.performance · n.headcount + Σ agg(c).perfWeightSum
agg(n).avgPerformance = perfWeightSum / totalHeadcount
```

Средняя эффективность взвешена по численности: команда из 30 человек влияет на среднее в 30 раз сильнее, чем узел с одним сотрудником. Узлы с `headcount = 0` в среднее не входят. Поэтому храним не среднее, а сумму весов: предок складывает `perfWeightSum` детей, не обходя поддерево заново.

**Полный расчёт** — один проход по `topDownOrder` в обратном порядке: дети всегда обрабатываются раньше родителей. Без рекурсии, O(n).

**Когда считается.** Один раз при построении модели в `queryFn`. Результат хранится в кэше TanStack Query вместе с индексом, поэтому компоненты его не пересчитывают. 304 и снимки той же ревизии возвращают уже готовую модель.

## Модель в кэше

```ts
interface OrgModel extends OrgIndex {
  version: { epoch: string; revision: number } | null // null — демо-сценарий без версии
  aggregates: ReadonlyMap<string, Aggregate>
}
```

Выбор между моделью в кэше и новым снимком (`pickCurrentModel`):

| Новый снимок относительно кэша | Результат |
| --- | --- |
| тот же epoch, та же ревизия | модель из кэша (без ререндера) |
| тот же epoch, ревизия старше | модель из кэша (запоздавший ответ не откатывает данные) |
| тот же epoch, ревизия новее | новый снимок |
| другой epoch или нет версии | новый снимок |
