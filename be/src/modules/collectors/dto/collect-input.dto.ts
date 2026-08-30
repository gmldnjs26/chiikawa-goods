import type { SourceConfig } from '@/modules/sources/dto/source-config.schema';

/** 어댑터 입력. 사이트별 차이는 전부 `config`가 흡수한다 */
export interface CollectInput {
  readonly sourceId: string;
  readonly baseUrl: string;
  readonly config: SourceConfig;
  /** 마지막 성공 시각. 첫 수집이면 `null` */
  readonly since: Date | null;
  /** robots.txt 준수값. 동시 요청은 항상 1이다 */
  readonly crawlDelaySec: number;
}
