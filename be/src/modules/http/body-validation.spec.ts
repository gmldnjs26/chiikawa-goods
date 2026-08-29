import { assertXmlBody, parseJsonBody } from './body-validation';
import { CollectError } from './http.errors';

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
      ).toThrow(CollectError);
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
        expect((error as CollectError).failureKind).toBe('validation');
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
