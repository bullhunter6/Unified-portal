import { describe, expect, it } from 'vitest';
import { parsePdfxPagination } from '../pagination';

describe('parsePdfxPagination', () => {
  it('uses safe defaults when pagination is omitted', () => {
    expect(parsePdfxPagination(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 20,
      skip: 0,
    });
  });

  it('parses valid page and size values', () => {
    expect(parsePdfxPagination(new URLSearchParams('page=3&size=25'))).toEqual({
      page: 3,
      pageSize: 25,
      skip: 50,
    });
  });

  it.each(['page=0', 'page=-1', 'page=1.5', 'page=text', 'size=0', 'size=101'])(
    'rejects invalid pagination: %s',
    (query) => {
      expect(parsePdfxPagination(new URLSearchParams(query))).toBeNull();
    },
  );
});
