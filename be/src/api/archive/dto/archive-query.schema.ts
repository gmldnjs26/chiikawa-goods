import { z } from 'zod';

import { ArchiveCursor, decodeCursor } from '@/modules/catalog/utils/cursor';

/** docs/read-api.md §5. 깨진 커서는 400이다 — 첫 페이지로 조용히 돌아가지 않는다 */
export const archiveQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z
    .string()
    .optional()
    .transform((raw, ctx): ArchiveCursor | null => {
      if (raw === undefined) return null;
      const cursor = decodeCursor(raw);
      if (cursor === null) {
        ctx.addIssue({
          code: 'custom',
          message: '커서가 깨졌다. 이전 응답의 nextCursor를 그대로 준다',
        });
        return z.NEVER;
      }
      return cursor;
    }),
});

export type ArchiveQuery = z.infer<typeof archiveQuerySchema>;
