import { describe, it, expect } from 'vitest';
import { parseQr, validateBackup, mergeItems, newItem, newStock, stockDelta, placePath } from './db';

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
describe('version 0.6 compatibility', () => {
  it('imports the original v1 backup layout without losing items', () => {
    const b=validateBackup({app:'workshop-inventory',version:1,items:[{id:'legacy',name:'Старый инструмент',photos:[]}]});
    expect(b.items[0].name).toBe('Старый инструмент');
    expect(b.stock).toEqual([]);
    expect(b.places).toEqual([]);
  });
  it('calculates stock intake and usage', () => {
    const item={...newStock(),qty:12};
    expect(stockDelta(item,'Приход',5)).toBe(5);
    expect(stockDelta(item,'Расход',3)).toBe(-3);
    expect(stockDelta(item,'Корректировка',7)).toBe(-5);
  });
  it('builds a hierarchical storage path', () => {
    const places=[{id:'a',name:'Мастерская',updated:0},{id:'b',name:'Шкаф',parentId:'a',updated:0},{id:'c',name:'Полка',parentId:'b',updated:0}];
    expect(placePath(places,'c')).toBe('Мастерская → Шкаф → Полка');
  });
});
