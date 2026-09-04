import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useConfigParam<T extends string>(
  key: string,
  allowedValues: readonly T[],
  defaultValue: T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo((): T => {
    const raw = searchParams.get(key);
    if (raw && (allowedValues as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return defaultValue;
  }, [searchParams, key, allowedValues, defaultValue]);

  const setValue = useCallback(
    (next: T) => {
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next === defaultValue) {
          nextParams.delete(key);
        } else {
          nextParams.set(key, next);
        }
        return nextParams;
      }, { replace: true });
    },
    [setSearchParams, key, defaultValue],
  );

  return [value, setValue];
}
