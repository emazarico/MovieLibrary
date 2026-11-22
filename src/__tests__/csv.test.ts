import { describe, expect, it } from 'vitest';
import { parseCsv, serializeCsv } from '../utils/csv';

describe('csv parser and serializer', () => {
  it('parses BOM, quoted commas, escaped quotes, and multiline reviews', () => {
    const raw =
      '\uFEFFTitle,Director,Review\r\n' +
      '"Dune: Part Two","Villeneuve, Denis","Amazing!\nTruly ""monolithic"" sci-fi."';

    const { headers, rows } = parseCsv(raw);
    expect(headers).toEqual(['Title', 'Director', 'Review']);
    expect(rows).toHaveLength(1);
    expect(rows[0].Title).toBe('Dune: Part Two');
    expect(rows[0].Director).toBe('Villeneuve, Denis');
    expect(rows[0].Review).toBe('Amazing!\nTruly "monolithic" sci-fi.');
  });

  it('round-trips serialized CSV rows with special characters', () => {
    const headers = ['Title', 'Tags', 'Rating'];
    const rows = [
      ['Spider-Man: Across the Spider-Verse', 'family-night, animation', 5],
      ['Flow', 'oscar, "quiet"', 4.5],
    ];
    const serialized = serializeCsv(headers, rows);
    const parsed = parseCsv(serialized);
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows[0].Tags).toBe('family-night, animation');
    expect(parsed.rows[1].Tags).toBe('oscar, "quiet"');
  });
});
