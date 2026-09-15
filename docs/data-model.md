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

## Live-обновления

WebSocket `/api/live`, типы в `shared/contract.ts`, валидация на клиенте — `src/features/live-updates/model/protocol.ts` (zod, те же ограничения полей, что у снимка).

```ts
type ServerMessage =
  | { type: 'hello'; epoch: string; revision: number }
  | { type: 'patch'; epoch: string; revision: number; changes: NodeChange[] }   // revision — после применения
  | { type: 'heartbeat'; epoch: string; revision: number; serverTime: string } // каждые 15 с

type NodeChange = { id: string; updatedAt: string }
  & Partial<Pick<OrgNode, 'name' | 'headcount' | 'budget' | 'performance'>>   // только изменившиеся поля
```

Инварианты сервера:

1. Каждый патч увеличивает ревизию ровно на 1. Изменение без реальной разницы значений ревизию не увеличивает и не рассылается.
2. В пределах одного соединения сообщения идут по порядку. `hello` всегда первое.
3. Структура (`id`, `parentId`) патчами не меняется.

Правила применения на клиенте (`SyncController`, подробно — ADR 004):

| Сообщение относительно модели (тот же epoch) | Действие |
| --- | --- |
| `patch.revision = model + 1` | применить |
| `patch.revision ≤ model` | отбросить (дубликат или уже учтён снимком) |
| `patch.revision > model + 1` | в очередь, запросить снимок |
| `hello`/`heartbeat` с ревизией модели или старше | live, запросов нет: снимок мог обогнать сообщения в сокете |
| `hello`/`heartbeat` новее модели | запросить снимок |
| любое сообщение другого epoch | запросить снимок; патчи прежнего epoch из очереди отбрасываются |

### Инкрементальная агрегация

`applyPatch` (`src/entities/org/model/applyPatch.ts`) пересчитывает только затронутые узлы:

```
dirty = { узлы с изменёнными headcount | budget | performance } ∪ их предки
для id из dirty по убыванию глубины:
  agg(id) = aggregateNode(node(id), agg(children(id)))   // та же формула, что при полной агрегации
  если agg(id) численно равен прежнему — оставить прежний объект
```

Пересчёт идёт из детей, а не прибавлением дельт. Поэтому после любого числа патчей результат совпадает с полной агрегацией тех же узлов, это проверено property-тестом на 300 случайных пакетах. Изменение только `name`/`updatedAt` агрегаты не трогает. Версия модели после патча — `(patch.epoch, patch.revision)`.

## Строки таблицы

`src/features/org-table/model/rows.ts`.

```ts
interface OrgTableRow {
  id: string
  name: string
  level: number                 // 1 — дивизион, 2 — отдел, 3 — команда (depth + 1)
  totalHeadcount: number        // из Aggregate
  totalBudget: number           // из Aggregate
  avgPerformance: number | null // из Aggregate
  searchKey: string             // нормализованное название
}
```

`buildRows(model, previous)` переиспользует строку прошлой версии, если у узла совпадают имя, уровень и суммарные показатели. После патча новые объекты получают только строки изменённого узла и его предков.

- **Порядок без сортировки** — обход дерева в глубину: родитель, затем его поддерево. Таблица читается так же, как дерево, названия смещены по уровню. После сортировки отступы убираются, иначе они вводят в заблуждение.
- **Сортировка** стабильная, при равных значениях сохраняется порядок дерева.
  - Названия сравниваются через `Intl.Collator('ru', { sensitivity: 'base', numeric: true })`: русский алфавит, «ё» рядом с «е», «Команда 2» раньше «Команда 10».
  - Узлы без сотрудников (`avgPerformance = null`) при сортировке по эффективности всегда в конце, в обоих направлениях.
- **Поиск** — подстрока в нормализованном названии. Нормализация: `trim`, схлопывание пробелов, нижний регистр, «ё» → «е». Ключ считается один раз при построении строк.

## Форматирование

`src/shared/lib/format.ts`, `Intl.NumberFormat('ru-RU')`.

| Значение | Пример | Правило |
| --- | --- | --- |
| Бюджет | `12 345 678 руб.` | округление до рубля; разряды и «руб.» отделены неразрывными пробелами (U+00A0), сумма не переносится |
| Численность | `1 234` | целое, разряды через неразрывный пробел |
| Средняя эффективность | `72,4` | один знак после запятой; `null` → «—». Цвет индикатора считается от показанного округлённого значения |

