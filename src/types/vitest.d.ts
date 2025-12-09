declare module 'vitest' {
  export const vi: {
    fn: <T extends (...args: any[]) => any>(implementation?: T) => T;
    mock: (module: string, factory: () => any) => void;
  };
}

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (value: unknown) => {
  toBeTruthy: () => void;
};
