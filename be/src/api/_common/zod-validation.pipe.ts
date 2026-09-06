import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * 쿼리 문자열을 경계에서 파싱한다 (be/CLAUDE.md §4 · docs/read-api.md §7).
 * `class-validator`가 아니라 zod인 이유: 요청 본문이 없고, `fe/`가 같은 도구로 응답을 검증한다.
 * 실패는 400 + zod issues. 조용히 기본값으로 돌아가지 않는다.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: '쿼리 파라미터가 형식에 맞지 않는다',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
