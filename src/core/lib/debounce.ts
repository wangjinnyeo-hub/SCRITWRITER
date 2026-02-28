/**
 * Debounced function with cancel and flush.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const run = (...args: Parameters<T>) => {
    lastArgs = args
    if (timeoutId != null) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      timeoutId = null
      if (lastArgs != null) {
        const args = lastArgs
        lastArgs = null
        fn(...args)
      }
    }, ms)
  }

  run.cancel = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  run.flush = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (lastArgs != null) {
      const args = lastArgs
      lastArgs = null
      fn(...args)
    }
  }

  return run
}

/**
 * Keyed debounce: separate timer per key. Useful for multiple independent fields (e.g. unitId).
 * - schedule(key, getValue): schedule a flush for key; getValue() is called at flush time.
 * - flush(key): run pending flush for key immediately and clear timer.
 * - cancel(key): clear timer without running.
 */
export function keyedDebounce<K extends string | number>(
  flushFn: (key: K, value: unknown) => void,
  ms: number
) {
  const timers = new Map<K, ReturnType<typeof setTimeout>>()
  const getValues = new Map<K, () => unknown>()

  const run = (key: K) => {
    const getVal = getValues.get(key)
    getValues.delete(key)
    timers.delete(key)
    if (getVal) flushFn(key, getVal())
  }

  return {
    schedule(key: K, getValue: () => unknown) {
      if (timers.has(key)) clearTimeout(timers.get(key)!)
      getValues.set(key, getValue)
      timers.set(
        key,
        setTimeout(() => run(key), ms)
      )
    },
    flush(key: K) {
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!)
        run(key)
      }
    },
    cancel(key: K) {
      if (timers.has(key)) {
        clearTimeout(timers.get(key)!)
        timers.delete(key)
        getValues.delete(key)
      }
    },
  }
}
