export type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
};

export type ApiResponse<T = unknown> = {
  status: (statusCode: number) => ApiResponse<T>;
  json: (body: T) => ApiResponse<T> | void;
};
