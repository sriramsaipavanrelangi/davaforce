export type D1Value = string | number | boolean | null;

export type D1PreparedStatementLike = {
  bind: (...values: D1Value[]) => D1PreparedStatementLike;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1DatabaseLike = {
  prepare: (sql: string) => D1PreparedStatementLike;
  batch?: (statements: D1PreparedStatementLike[]) => Promise<unknown>;
  exec?: (sql: string) => Promise<unknown>;
};

export type R2ObjectLike = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  httpMetadata?: {
    contentType?: string;
  };
};

export type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectLike | null>;
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    },
  ) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

export type DavaforceCloudflareBindings = {
  DB: D1DatabaseLike;
  WORKFORCE_UPLOADS: R2BucketLike;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type DavaforceCloudflareRuntime = {
  env: DavaforceCloudflareBindings;
};

type OpenNextCloudflareContext = {
  env?: Partial<DavaforceCloudflareBindings>;
};

export const getCloudflareRuntime = async (): Promise<DavaforceCloudflareRuntime | null> => {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = (await getCloudflareContext({ async: true })) as OpenNextCloudflareContext;
    const env = context.env;
    if (!env?.DB || !env.WORKFORCE_UPLOADS) {
      return null;
    }

    return {
      env: {
        DB: env.DB,
        WORKFORCE_UPLOADS: env.WORKFORCE_UPLOADS,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        OPENAI_MODEL: env.OPENAI_MODEL,
      },
    };
  } catch {
    return null;
  }
};

export const hasCloudflareRuntime = async () => (await getCloudflareRuntime()) != null;
