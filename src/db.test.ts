import { describe, it, expect } from 'vitest';
import { parseQr, validateBackup, mergeItems, newItem } from './db';

describe('qr', () => {
  it('разбирает ссылку и голый id', () => {
    const id = crypto.randomUUID();
    expect(parseQr(`https://x.github.io/Workshop-Inventory/#/i/${id}`)).toBe(id);
    expect(parseQr(id)).toBe(id);
  });
  it('отклоняет мусор', () => expect(parseQr('hello')).toBeNull());
});

describe('backup', () => {
  it('проверяет формат', () => {
    expect(() => validateBackup({})).toThrow();
    expect(() => validateBackup({ app: 'workshop-inventory', version: 1, items: [{ id: 1 }] })).toThrow();
  });
  it('объединяет по дате изменения', () => {
    const a = { ...newItem(), name: 'A', updated: 1 };
    const r = mergeItems([a], [{ ...a, name: 'B', updated: 2 }, { ...newItem(), name: 'C' }]);
    expect(r.added).toBe(1); expect(r.updated).toBe(1);
  });
});