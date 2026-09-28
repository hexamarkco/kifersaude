declare module 'vitest' {
  export type MockSpy = {
    mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockSpy;
    mock: { calls: unknown[][] };
  };

  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const vi: {
    fn: <T extends (...args: unknown[]) => unknown>(implementation?: T) => T;
    hoisted: <T>(factory: () => T) => T;
    mock: (module: string, factory: () => unknown) => void;
    useFakeTimers: () => void;
    useRealTimers: () => void;
    clearAllTimers: () => void;
    advanceTimersByTimeAsync: (milliseconds: number) => Promise<void>;
    getTimerCount: () => number;
    spyOn: (object: object, method: string) => MockSpy;
    restoreAllMocks: () => void;
  };
}

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (value: unknown) => {
  toBeTruthy: () => void;
};
