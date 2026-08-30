/**
 * 신원과 연락처를 밝힌다 (docs/data-collection-design.md §4.1).
 * 저장소 주소를 넣는 이유 — 상대가 문제를 발견했을 때 차단 말고 연락할 길을 준다.
 */
export const USER_AGENT = 'chiikawa-goods-bot/0.1 (+https://github.com/gmldnjs26/chiikawa-goods)';

/** `robots.txt`의 User-agent 그룹 매칭에 쓰는 토큰. 괄호 앞부분만이다 */
export const UA_TOKEN = 'chiikawa-goods-bot';
