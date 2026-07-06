const dedupeCache = new Map<string, Promise<string>>();

type EntityWithHandle = { id: string };

export type GetOrCreateEntity = {
  fromHandle: (handle: string) => Promise<EntityWithHandle | null>;
  create: (opts: object) => Promise<{ id: string }>;
};

export function asEntity(entity: object): GetOrCreateEntity {
  return entity as GetOrCreateEntity;
}

export async function getOrCreateCachedItem(
  entityType: GetOrCreateEntity,
  handle: string,
  title: string,
  cacheKey: string,
  extraOpts: object | (() => object) = {},
): Promise<string> {
  let promise = dedupeCache.get(cacheKey);
  if (!promise) {
    promise = entityType.fromHandle(handle).then(async (item) => {
      if (item?.id) {
        return item.id;
      }

      const resolvedExtraOpts =
        typeof extraOpts === "function" ? extraOpts() : extraOpts;

      const created = await entityType.create({
        handle,
        title,
        ...resolvedExtraOpts,
      });

      return created.id;
    });
    dedupeCache.set(cacheKey, promise);
  }

  return promise;
}

export function resetDedupeCache(): void {
  dedupeCache.clear();
}
