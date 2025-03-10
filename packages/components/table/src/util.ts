// @ts-nocheck
import { createPopper } from '@popperjs/core'
import { flatMap, get, merge } from 'lodash-unified'
import escapeHtml from 'escape-html'
import {
  hasOwn,
  isArray,
  isBoolean,
  isObject,
  throwError,
} from '@element-plus/utils'
import { useDelayedToggle } from '@element-plus/hooks'
import type { PopperInstance } from '@element-plus/components/popper'
import type { Nullable } from '@element-plus/utils'
import type { TableColumnCtx } from './table-column/defaults'
import type { ElTooltipProps } from '@element-plus/components/tooltip'

export type TableOverflowTooltipOptions = Partial<
  Pick<
    ElTooltipProps,
    | 'effect'
    | 'enterable'
    | 'hideAfter'
    | 'offset'
    | 'placement'
    | 'popperClass'
    | 'popperOptions'
    | 'showAfter'
    | 'showArrow'
    // | 'transition'
  >
>

export const getCell = function (event: Event) {
  return (event.target as HTMLElement)?.closest('td')
}

export const orderBy = function <T>(
  array: T[],
  sortKey: string,
  reverse: string | number,
  sortMethod,
  sortBy: string | (string | ((a: T, b: T, array?: T[]) => number))[]
) {
  if (
    !sortKey &&
    !sortMethod &&
    (!sortBy || (Array.isArray(sortBy) && !sortBy.length))
  ) {
    return array
  }
  if (typeof reverse === 'string') {
    reverse = reverse === 'descending' ? -1 : 1
  } else {
    reverse = reverse && reverse < 0 ? -1 : 1
  }
  const getKey = sortMethod
    ? null
    : function (value, index) {
        if (sortBy) {
          if (!Array.isArray(sortBy)) {
            sortBy = [sortBy]
          }
          return sortBy.map((by) => {
            if (typeof by === 'string') {
              return get(value, by)
            } else {
              return by(value, index, array)
            }
          })
        }
        if (sortKey !== '$key') {
          if (isObject(value) && '$value' in value) value = value.$value
        }
        return [isObject(value) ? get(value, sortKey) : value]
      }
  const compare = function (a, b) {
    if (sortMethod) {
      return sortMethod(a.value, b.value)
    }
    for (let i = 0, len = a.key.length; i < len; i++) {
      if (a.key[i] < b.key[i]) {
        return -1
      }
      if (a.key[i] > b.key[i]) {
        return 1
      }
    }
    return 0
  }
  return array
    .map((value, index) => {
      return {
        value,
        index,
        key: getKey ? getKey(value, index) : null,
      }
    })
    .sort((a, b) => {
      let order = compare(a, b)
      if (!order) {
        // make stable https://en.wikipedia.org/wiki/Sorting_algorithm#Stability
        order = a.index - b.index
      }
      return order * +reverse
    })
    .map((item) => item.value)
}

export const getColumnById = function <T>(
  table: {
    columns: TableColumnCtx<T>[]
  },
  columnId: string
): null | TableColumnCtx<T> {
  let column = null
  table.columns.forEach((item) => {
    if (item.id === columnId) {
      column = item
    }
  })
  return column
}

export const getColumnByKey = function <T>(
  table: {
    columns: TableColumnCtx<T>[]
  },
  columnKey: string
): TableColumnCtx<T> {
  let column = null
  for (let i = 0; i < table.columns.length; i++) {
    const item = table.columns[i]
    if (item.columnKey === columnKey) {
      column = item
      break
    }
  }
  if (!column)
    throwError('ElTable', `No column matching with column-key: ${columnKey}`)
  return column
}

export const getColumnByCell = function <T>(
  table: {
    columns: TableColumnCtx<T>[]
  },
  cell: HTMLElement,
  namespace: string
): null | TableColumnCtx<T> {
  const matches = (cell.className || '').match(
    new RegExp(`${namespace}-table_[^\\s]+`, 'gm')
  )
  if (matches) {
    return getColumnById(table, matches[0])
  }
  return null
}

export const getRowIdentity = <T>(
  row: T,
  rowKey: string | ((row: T) => any)
): string => {
  if (!row) throw new Error('Row is required when get row identity')
  if (typeof rowKey === 'string') {
    if (!rowKey.includes('.')) {
      return `${row[rowKey]}`
    }
    const key = rowKey.split('.')
    let current = row
    for (const element of key) {
      current = current[element]
    }
    return `${current}`
  } else if (typeof rowKey === 'function') {
    return rowKey.call(null, row)
  }
}

export const getKeysMap = function <T>(
  array: T[],
  rowKey: string
): Record<string, { row: T; index: number }> {
  const arrayMap = {}
  ;(array || []).forEach((row, index) => {
    arrayMap[getRowIdentity(row, rowKey)] = { row, index }
  })
  return arrayMap
}

export function mergeOptions<T, K>(defaults: T, config: K): T & K {
  const options = {} as T & K
  let key
  for (key in defaults) {
    options[key] = defaults[key]
  }
  for (key in config) {
    if (hasOwn(config as unknown as Record<string, any>, key)) {
      const value = config[key]
      if (typeof value !== 'undefined') {
        options[key] = value
      }
    }
  }
  return options
}

export function parseWidth(width: number | string): number | string {
  if (width === '') return width
  if (width !== undefined) {
    width = Number.parseInt(width as string, 10)
    if (Number.isNaN(width)) {
      width = ''
    }
  }
  return width
}

export function parseMinWidth(minWidth: number | string): number | string {
  if (minWidth === '') return minWidth
  if (minWidth !== undefined) {
    minWidth = parseWidth(minWidth)
    if (Number.isNaN(minWidth)) {
      minWidth = 80
    }
  }
  return minWidth
}

export function parseHeight(height: number | string) {
  if (typeof height === 'number') {
    return height
  }
  if (typeof height === 'string') {
    if (/^\d+(?:px)?$/.test(height)) {
      return Number.parseInt(height, 10)
    } else {
      return height
    }
  }
  return null
}

// https://github.com/reduxjs/redux/blob/master/src/compose.js
export function compose(...funcs) {
  if (funcs.length === 0) {
    return (arg) => arg
  }
  if (funcs.length === 1) {
    return funcs[0]
  }
  return funcs.reduce(
    (a, b) =>
      (...args) =>
        a(b(...args))
  )
}

export function toggleRowStatus<T>(
  statusArr: T[],
  row: T,
  newVal: boolean
): boolean {
  let changed = false
  const index = statusArr.indexOf(row)
  const included = index !== -1

  const toggleStatus = (type: 'add' | 'remove') => {
    if (type === 'add') {
      statusArr.push(row)
    } else {
      statusArr.splice(index, 1)
    }
    changed = true
    if (isArray(row.children)) {
      row.children.forEach((item) => {
        toggleRowStatus(statusArr, item, newVal ?? !included)
      })
    }
  }

  if (isBoolean(newVal)) {
    if (newVal && !included) {
      toggleStatus('add')
    } else if (!newVal && included) {
      toggleStatus('remove')
    }
  } else {
    included ? toggleStatus('remove') : toggleStatus('add')
  }
  return changed
}

export function walkTreeNode(
  root,
  cb,
  childrenKey = 'children',
  lazyKey = 'hasChildren'
) {
  const isNil = (array) => !(Array.isArray(array) && array.length)

  function _walker(parent, children, level) {
    cb(parent, children, level)
    children.forEach((item) => {
      if (item[lazyKey]) {
        cb(item, null, level + 1)
        return
      }
      const children = item[childrenKey]
      if (!isNil(children)) {
        _walker(item, children, level + 1)
      }
    })
  }

  root.forEach((item) => {
    if (item[lazyKey]) {
      cb(item, null, 0)
      return
    }
    const children = item[childrenKey]
    if (!isNil(children)) {
      _walker(item, children, 0)
    }
  })
}

export let removePopper

export function createTablePopper(
  parentNode: HTMLElement | undefined,
  trigger: HTMLElement,
  popperContent: string,
  nextZIndex: () => number,
  tooltipOptions?: TableOverflowTooltipOptions
) {
  // TODO transition
  tooltipOptions = merge(
    {
      enterable: true,
      showArrow: true,
    } as TableOverflowTooltipOptions,
    tooltipOptions
  )
  const ns = parentNode?.dataset.prefix
  const scrollContainer = parentNode?.querySelector(`.${ns}-scrollbar__wrap`)
  function renderContent(): HTMLDivElement {
    const isLight = tooltipOptions.effect === 'light'
    const content = document.createElement('div')
    content.className = [
      `${ns}-popper`,
      isLight ? 'is-light' : 'is-dark',
      tooltipOptions.popperClass || '',
    ].join(' ')
    popperContent = escapeHtml(popperContent)
    content.innerHTML = popperContent
    content.style.zIndex = String(nextZIndex())
    // Avoid side effects caused by append to body
    parentNode?.appendChild(content)
    return content
  }
  function renderArrow(): HTMLDivElement {
    const arrow = document.createElement('div')
    arrow.className = `${ns}-popper__arrow`
    return arrow
  }
  function togglePopperVisible(display: 'none' | 'block') {
    return {
      name: 'updateState',
      enabled: true,
      phase: 'beforeWrite',
      fn: ({ state }) => {
        state.styles.popper.display = display
      },
      requires: ['computeStyles'],
    }
  }
  function showPopper() {
    if (tooltipOptions.showAfter) {
      popperInstance?.setOptions({
        modifiers: [togglePopperVisible('block')],
      })
    }
    popperInstance?.update()
  }

  const triggerChanged = removePopper?.trigger !== trigger
  removePopper?.()
  removePopper = () => {
    try {
      popperInstance && popperInstance.destroy()
      content && parentNode?.removeChild(content)
      trigger.removeEventListener('mouseenter', onOpen)
      trigger.removeEventListener('mouseleave', onClose)
      scrollContainer?.removeEventListener('scroll', removePopper)
      removePopper = undefined
    } catch {}
  }
  removePopper.trigger = trigger

  let popperInstance: Nullable<PopperInstance> = null
  const { onOpen, onClose } = useDelayedToggle({
    showAfter: tooltipOptions.showAfter,
    hideAfter: tooltipOptions.hideAfter,
    open: showPopper,
    close: removePopper,
  })
  const content = renderContent()
  if (tooltipOptions.enterable) {
    content.onmouseenter = onOpen
    content.onmouseleave = onClose
  }
  const modifiers = []
  if (tooltipOptions.offset) {
    modifiers.push({
      name: 'offset',
      options: {
        offset: [0, tooltipOptions.offset],
      },
    })
  }
  if (tooltipOptions.showArrow) {
    const arrow = content.appendChild(renderArrow())
    modifiers.push({
      name: 'arrow',
      options: {
        element: arrow,
        padding: 10,
      },
    })
  }
  if (tooltipOptions.showAfter && triggerChanged) {
    modifiers.push(togglePopperVisible('none'))
  }
  const popperOptions = tooltipOptions.popperOptions || {}
  popperInstance = createPopper(trigger, content, {
    placement: tooltipOptions.placement || 'top',
    strategy: 'fixed',
    ...popperOptions,
    modifiers: popperOptions.modifiers
      ? modifiers.concat(popperOptions.modifiers)
      : modifiers,
  })
  trigger.addEventListener('mouseenter', onOpen)
  trigger.addEventListener('mouseleave', onClose)
  scrollContainer?.addEventListener('scroll', removePopper)
  onOpen()
  return popperInstance
}

function getCurrentColumns<T>(column: TableColumnCtx<T>): TableColumnCtx<T>[] {
  if (column.children) {
    return flatMap(column.children, getCurrentColumns)
  } else {
    return [column]
  }
}

function getColSpan<T>(colSpan: number, column: TableColumnCtx<T>) {
  return colSpan + column.colSpan
}

export const isFixedColumn = <T>(
  index: number,
  fixed: string | boolean,
  store: any,
  realColumns?: TableColumnCtx<T>[]
) => {
  let start = 0
  let after = index
  const columns = store.states.columns.value
  if (realColumns) {
    // fixed column supported in grouped header
    const curColumns = getCurrentColumns(realColumns[index])
    const preColumns = columns.slice(0, columns.indexOf(curColumns[0]))

    start = preColumns.reduce(getColSpan, 0)
    after = start + curColumns.reduce(getColSpan, 0) - 1
  } else {
    start = index
  }
  let fixedLayout
  switch (fixed) {
    case 'left':
      if (after < store.states.fixedLeafColumnsLength.value) {
        fixedLayout = 'left'
      }
      break
    case 'right':
      if (
        start >=
        columns.length - store.states.rightFixedLeafColumnsLength.value
      ) {
        fixedLayout = 'right'
      }
      break
    default:
      if (after < store.states.fixedLeafColumnsLength.value) {
        fixedLayout = 'left'
      } else if (
        start >=
        columns.length - store.states.rightFixedLeafColumnsLength.value
      ) {
        fixedLayout = 'right'
      }
  }
  return fixedLayout
    ? {
        direction: fixedLayout,
        start,
        after,
      }
    : {}
}

export const getFixedColumnsClass = <T>(
  namespace: string,
  index: number,
  fixed: string | boolean,
  store: any,
  realColumns?: TableColumnCtx<T>[],
  offset = 0
) => {
  const classes: string[] = []
  const { direction, start, after } = isFixedColumn(
    index,
    fixed,
    store,
    realColumns
  )
  if (direction) {
    const isLeft = direction === 'left'
    classes.push(`${namespace}-fixed-column--${direction}`)
    if (
      isLeft &&
      after + offset === store.states.fixedLeafColumnsLength.value - 1
    ) {
      classes.push('is-last-column')
    } else if (
      !isLeft &&
      start - offset ===
        store.states.columns.value.length -
          store.states.rightFixedLeafColumnsLength.value
    ) {
      classes.push('is-first-column')
    }
  }
  return classes
}

function getOffset<T>(offset: number, column: TableColumnCtx<T>) {
  return (
    offset +
    (column.realWidth === null || Number.isNaN(column.realWidth)
      ? Number(column.width)
      : column.realWidth)
  )
}

export const getFixedColumnOffset = <T>(
  index: number,
  fixed: string | boolean,
  store: any,
  realColumns?: TableColumnCtx<T>[]
) => {
  const {
    direction,
    start = 0,
    after = 0,
  } = isFixedColumn(index, fixed, store, realColumns)
  if (!direction) {
    return
  }
  const styles: any = {}
  const isLeft = direction === 'left'
  const columns = store.states.columns.value
  if (isLeft) {
    styles.left = columns.slice(0, start).reduce(getOffset, 0)
  } else {
    styles.right = columns
      .slice(after + 1)
      .reverse()
      .reduce(getOffset, 0)
  }
  return styles
}

export const ensurePosition = (style, key: string) => {
  if (!style) return
  if (!Number.isNaN(style[key])) {
    style[key] = `${style[key]}px`
  }
}
