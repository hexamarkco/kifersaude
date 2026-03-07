declare module 'vitest' {
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const vi: {
    fn: <T extends (...args: unknown[]) => unknown>(implementation?: T) => T;
    mock: (module: string, factory: () => unknown) => void;
  };
}

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (value: unknown) => {
  toBeTruthy: () => void;
};
