import { describe, expect, it } from 'vitest';
import { FOLIO_PREFIXES, folioPeriod, formatFolio, parseFolioTemplate } from './folios.js';

describe('folios automáticos (HU-38)', () => {
  it('el periodo es AAMM de la fecha local', () => {
    expect(folioPeriod('2026-10-28')).toBe('2610');
    expect(folioPeriod('2027-01-03')).toBe('2701');
  });

  it('prefijo + AAMM + "-" + contador de 3 dígitos', () => {
    expect(formatFolio(FOLIO_PREFIXES.ONGOING, '2610', 1)).toBe('MT2610-001');
    expect(formatFolio(FOLIO_PREFIXES.WITH_END, '2611', 42)).toBe('PY2611-042');
    expect(formatFolio(FOLIO_PREFIXES.ON_DEMAND, '2612', 7)).toBe('ACT2612-007');
  });

  it('reconoce el formato sin número para completarlo', () => {
    expect(parseFolioTemplate('MT')).toEqual({ prefix: 'MT', period: null });
    expect(parseFolioTemplate(' py2611- ')).toEqual({ prefix: 'PY', period: '2611' });
    expect(parseFolioTemplate('ACT2610')).toEqual({ prefix: 'ACT', period: '2610' });
    expect(parseFolioTemplate('MT2610-004')).toBeNull();
    expect(parseFolioTemplate('SOL-123')).toBeNull();
    expect(parseFolioTemplate('MTX')).toBeNull();
  });

  it('pasado el 999 sigue creciendo', () => {
    expect(formatFolio('MT', '2610', 1000)).toBe('MT2610-1000');
  });
});
