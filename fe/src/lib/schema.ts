import { z } from 'zod';

/**
 * 읽기 API 응답 형태 (docs/read-api.md §2–§5). **`be/src/modules/catalog/dto/card.dto.ts`와 같은 형태다.**
 * 문서가 진실이고 여기는 그것을 옮긴 것이다. 형태를 바꾸면 문서 → be → 여기 순서로 바꾼다.
 *
 * `z.infer`가 유일한 타입 출처다 (fe/CLAUDE.md §3). `as`로 받지 않는다.
 * 날짜는 JST 달력일 `YYYY-MM-DD`, 시각은 ISO 8601, id는 문자열(bigint).
 */

/** `YYYY-MM-DD`. 실제 달력 검증은 하지 않는다 — 서버가 만든 값이고 화면은 그대로 표기한다 */
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD가 아니다');

/** 선언 순서가 캘린더의 채널 정렬 순서다 (docs/read-api.md §4.1) */
export const channelSchema = z.enum([
  'online_official',
  'konbini',
  'arcade',
  'gacha',
  'kuji',
  'store',
  'apparel',
]);

export const statusSchema = z.enum(['UPCOMING', 'ON_SALE', 'ENDED']);
export const scheduleKindSchema = z.enum(['preorder', 'release', 'restock']);
export const acquisitionSchema = z.enum(['fixed', 'random']);

export const scheduleSchema = z.object({
  kind: scheduleKindSchema,
  date: calendarDateSchema.nullable(),
  /** `9月下旬` 원문. 날짜로 바꾸지 않는다 */
  text: z.string().nullable(),
  undecided: z.boolean(),
  observedAt: z.string(),
});

export const sourceRefSchema = z.object({
  code: z.string(),
  name: z.string(),
  url: z.string(),
  observedAt: z.string(),
});

export const cardSchema = z.object({
  id: z.string(),
  title: z.string(),
  officialUrl: z.string(),
  /** 원본 CDN. 이미지 게이트 미허가면 null — 카드는 선다 */
  imageUrl: z.string().nullable(),
  price: z.number().int().nullable(),
  priceVaries: z.boolean(),
  /** null = 미판정. 화면이 `その他`로 보여준다 */
  brand: z.object({ code: z.string(), label: z.string() }).nullable(),
  channel: channelSchema,
  region: z.string(),
  acquisition: acquisitionSchema,
  seriesTotal: z.number().int().nullable(),
  labels: z.array(z.string()),
  status: statusSchema,
  statusAt: z.string(),
  preorderOn: calendarDateSchema.nullable(),
  releaseOn: calendarDateSchema.nullable(),
  /** 개시 시각은 추정치다. 화면은 확정값과 구분해서 낸다 */
  timeEstimated: z.boolean(),
  availableUntil: calendarDateSchema.nullable(),
  /** 가장 최근 ENDED → ON_SALE 전이 시각. 📦 폭은 화면 규칙 (modules/item/consts.ts) */
  restockedAt: z.string().nullable(),
  /** 유효 예정 전부. 같은 kind가 2건 이상일 수 있다 — badge.ts가 판정 불가로 낸다 */
  schedules: z.array(scheduleSchema),
  sources: z.array(sourceRefSchema).min(1),
});

export const calendarEventSchema = z.object({
  date: calendarDateSchema,
  kind: scheduleKindSchema,
  item: cardSchema,
});

/**
 * 응답 봉투. 카드 배열은 `z.unknown()`으로 받는다 — 카드 하나가 깨졌다고 화면 전체를 버리지 않는다.
 * 항목 단위 파싱은 아래 `parseHome` 등이 한다 (실패한 항목은 빼고 로그).
 */
export const homeEnvelopeSchema = z.object({
  generatedAt: z.string(),
  today: calendarDateSchema,
  onSale: z.array(z.unknown()),
  upcoming: z.array(z.unknown()),
  waitable: z.array(z.unknown()),
});

export const calendarEnvelopeSchema = z.object({
  generatedAt: z.string(),
  today: calendarDateSchema,
  from: calendarDateSchema,
  to: calendarDateSchema,
  events: z.array(z.unknown()),
});

export const archiveEnvelopeSchema = z.object({
  generatedAt: z.string(),
  items: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
});

export type CalendarDate = z.infer<typeof calendarDateSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type ItemStatus = z.infer<typeof statusSchema>;
export type ScheduleKind = z.infer<typeof scheduleKindSchema>;
export type Acquisition = z.infer<typeof acquisitionSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Card = z.infer<typeof cardSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

/** 항목 단위 파싱을 끝낸 응답. 화면은 이것만 본다 */
export interface HomeResponse {
  readonly generatedAt: string;
  readonly today: CalendarDate;
  readonly onSale: readonly Card[];
  readonly upcoming: readonly Card[];
  readonly waitable: readonly Card[];
}

export interface CalendarResponse {
  readonly generatedAt: string;
  readonly today: CalendarDate;
  readonly from: CalendarDate;
  readonly to: CalendarDate;
  readonly events: readonly CalendarEvent[];
}

export interface ArchiveResponse {
  readonly generatedAt: string;
  readonly items: readonly Card[];
  readonly nextCursor: string | null;
}

/**
 * 배열을 항목 단위로 파싱한다. 실패한 항목은 **빼고 로그를 남긴다** — 조용히 넘기지 않는다.
 * 백엔드가 형태를 바꾸면 여기서 드러난다. 그게 목적이다.
 */
export function parseEach<T>(
  schema: z.ZodType<T>,
  rows: readonly unknown[],
  where: string,
  log: (message: string) => void = (message) => console.error(message),
): T[] {
  const out: T[] = [];
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      out.push(result.data);
      return;
    }
    const id = typeof row === 'object' && row !== null && 'id' in row ? String(row.id) : '?';
    log(`[schema] ${where}[${index}] id=${id} 파싱 실패: ${z.prettifyError(result.error)}`);
  });
  return out;
}

export function parseHome(raw: unknown): HomeResponse {
  const envelope = homeEnvelopeSchema.parse(raw);
  return {
    generatedAt: envelope.generatedAt,
    today: envelope.today,
    onSale: parseEach(cardSchema, envelope.onSale, 'home.onSale'),
    upcoming: parseEach(cardSchema, envelope.upcoming, 'home.upcoming'),
    waitable: parseEach(cardSchema, envelope.waitable, 'home.waitable'),
  };
}

export function parseCalendar(raw: unknown): CalendarResponse {
  const envelope = calendarEnvelopeSchema.parse(raw);
  return {
    generatedAt: envelope.generatedAt,
    today: envelope.today,
    from: envelope.from,
    to: envelope.to,
    events: parseEach(calendarEventSchema, envelope.events, 'calendar.events'),
  };
}

export function parseArchive(raw: unknown): ArchiveResponse {
  const envelope = archiveEnvelopeSchema.parse(raw);
  return {
    generatedAt: envelope.generatedAt,
    items: parseEach(cardSchema, envelope.items, 'archive.items'),
    nextCursor: envelope.nextCursor,
  };
}
