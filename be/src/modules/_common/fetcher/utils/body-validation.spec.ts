import { FetchError } from '../errors/fetch.error';
import { isBlockSignal, retryAfterMs } from './block-signal';
import { assertXmlBody, parseJsonBody } from './body-validation';

describe('본문 검증', () => {
  describe('parseJsonBody', () => {
    it('기대 키가 있으면 통과한다', () => {
      const parsed = parseJsonBody<{ products: unknown[] }>(
        'https://example.test/products.json',
        '{"products":[]}',
        ['products'],
      );
      expect(parsed.products).toEqual([]);
    });

    it('200 + HTML(소프트 404)을 실패로 잡는다', () => {
      expect(() =>
        parseJsonBody('https://example.test/x.json', '<!DOCTYPE html><html>...', ['products']),
      ).toThrow(FetchError);
    });

    it('형식은 JSON이지만 기대 키가 없으면 실패다', () => {
      expect(() => parseJsonBody('https://example.test/x.json', '{"errors":"Not Found"}', ['products']))
        .toThrow(/기대 키가 없다/);
    });

    it('실패는 failure_kind=validation이다', () => {
      try {
        parseJsonBody('https://example.test/x.json', 'nope', []);
        fail('던져야 한다');
      } catch (error) {
        expect((error as FetchError).kind).toBe('validation');
      }
    });
  });

  describe('assertXmlBody', () => {
    it.each(['<?xml version="1.0"?><urlset/>', '<urlset xmlns="x"/>', '<sitemapindex/>'])(
      '%s 를 XML로 본다',
      (body) => {
        expect(assertXmlBody('https://example.test/sitemap.xml', body)).toContain('<');
      },
    );

    it('Content-Type이 xml이어도 본문이 HTML이면 실패다', () => {
      expect(() => assertXmlBody('https://example.test/sitemap.xml', '<!DOCTYPE html><html>')).toThrow(
        /XML이 아니다/,
      );
    });

    it('BOM이 앞에 붙어도 통과한다', () => {
      expect(() => assertXmlBody('https://example.test/s.xml', '﻿<?xml version="1.0"?>')).not.toThrow();
    });
  });
});

describe('isBlockSignal — 오탐 방지', () => {
  it('정상 JSON 본문에 챌린지스러운 문자열이 있어도 차단이 아니다', () => {
    const body = JSON.stringify({ products: [{ title: 'Just a moment 티셔츠' }] });
    const response = new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    // 오탐의 대가가 enabled=false 영구 정지다. JSON은 챌린지가 아니다
    expect(isBlockSignal(response, body)).toBe(false);
  });

  it('HTML 인터스티셜은 200이어도 차단이다', () => {
    const body = '<!DOCTYPE html><html>Just a moment...</html>';
    expect(isBlockSignal(new Response(body, { status: 200 }), body)).toBe(true);
  });

  it('403은 본문과 무관하게 차단이다', () => {
    expect(isBlockSignal(new Response('{}', { status: 403 }), '{}')).toBe(true);
  });

  it('Retry-After를 밀리초로 읽는다', () => {
    const response = new Response('', { status: 503, headers: { 'retry-after': '30' } });
    expect(retryAfterMs(response)).toBe(30_000);
    expect(retryAfterMs(new Response('', { status: 503 }))).toBe(0);
  });
});
