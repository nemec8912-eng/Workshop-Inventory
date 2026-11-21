import Dexie, { Table } from 'dexie';

export const STATUSES = ['В наличии', 'Неисправен', 'Списан'] as const;
export type Status = (typeof STATUSES)[number];
export const CATEGORIES = ['Электроинструменты', 'Ручные инструменты', 'Измерительные приборы', 'Станки и оборудование', 'Аккумуляторы', 'Зарядные устройства', 'Оснастка', 'Запчасти', 'Крепёж', 'Электротовары', 'Расходные материалы', 'Прочее'];

export interface Item {
  id: string; // постоянный идентификатор, он же содержимое QR-ссылки
  name: string;
  category: string;
  maker?: string; model?: string; serial?: string; invNo?: string;
  desc?: string; place?: string; notes?: string;
  status: Status;
  previousStatus?: string; // старый статус сохранён при миграции
  price?: number; currency?: string; bought?: string; shop?: string; warranty?: string;
  photos: string[]; // сжатые изображения (dataURL), первое — главное
  deleted?: boolean;
  created: number; updated: number;
}

class WorkshopDB extends Dexie {
  items!: Table<Item, string>;
  constructor() {
    super('workshop-inventory');
    this.version(1).stores({ items: 'id,name,category,status,updated' });
    this.version(2).stores({ items: 'id,name,category,status,updated' }).upgrade(async tx => {
      await tx.table('items').toCollection().modify((item: Item) => {
        if (item.status === ('Выдан' as Status) || item.status === ('В работе' as Status) || item.status === ('На ремонте' as Status)) {
          item.previousStatus = item.status;
          item.status = item.status === ('На ремонте' as Status) ? 'Неисправен' : 'В наличии';
        }
      });
    });
  }
}
export const db = new WorkshopDB();

export const newItem = (): Item => ({
  id: crypto.randomUUID(), name: '', category: CATEGORIES[0], status: 'В наличии', currency: 'RUB',
  photos: [], created: Date.now(), updated: Date.now()
});

// ---------- резервные копии ----------
export const BACKUP_VERSION = 1;

export function validateBackup(data: any): Item[] {
  if (!data || typeof data !== 'object' || data.app !== 'workshop-inventory' || !Array.isArray(data.items))
    throw new Error('Это не резервная копия Workshop Inventory');
  if (data.version > BACKUP_VERSION) throw new Error('Копия создана более новой версией приложения');
  return data.items.map((i: any) => {
    if (typeof i?.id !== 'string' || typeof i?.name !== 'string') throw new Error('Повреждена запись в копии');
    const legacy = ['Выдан', 'В работе', 'На ремонте'].includes(i.status);
    return { ...newItem(), ...i, status: legacy ? (i.status === 'На ремонте' ? 'Неисправен' : 'В наличии') : i.status,
      previousStatus: legacy ? i.status : i.previousStatus,
      photos: Array.isArray(i.photos) ? i.photos.filter((p: any) => typeof p === 'string' && p.startsWith('data:image/')) : [] } as Item;
  });
}

/** Объединение: запись с большей датой изменения побеждает; ничего не удаляется. */
export function mergeItems(local: Item[], incoming: Item[]): { toWrite: Item[]; added: number; updated: number } {
  const map = new Map(local.map(i => [i.id, i]));
  const toWrite: Item[] = []; let added = 0, updated = 0;
  for (const i of incoming) {
    const cur = map.get(i.id);
    if (!cur) { toWrite.push(i); added++; }
    else if (i.updated > cur.updated) { toWrite.push(i); updated++; }
  }
  return { toWrite, added, updated };
}

export async function exportBackup() {
  const items = await db.items.toArray();
  return JSON.stringify({ app: 'workshop-inventory', version: BACKUP_VERSION, exported: new Date().toISOString(), items });
}

// ---------- фото ----------
export function resizeImage(file: File, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => rej(new Error('Не удалось прочитать изображение'));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- QR ----------
export const itemUrl = (id: string) => `${location.origin}${location.pathname}#/i/${id}`;
export function parseQr(text: string): string | null {
  const m = text.match(/#\/i\/([0-9a-f-]{36})$/i) || text.match(/^([0-9a-f-]{36})$/i);
  return m ? m[1].toLowerCase() : null;
}