import Dexie, { Table } from 'dexie';

export const CATEGORIES = ['Электроинструменты', 'Ручные инструменты', 'Измерительные приборы', 'Станки и оборудование', 'Аккумуляторы', 'Зарядные устройства', 'Оснастка', 'Запчасти', 'Крепёж', 'Электротовары', 'Расходные материалы', 'Прочее'];

export interface Item {
  id: string; // постоянный идентификатор, он же содержимое QR-ссылки
  name: string;
  category: string;
  maker?: string; model?: string; serial?: string; invNo?: string;
  desc?: string; place?: string; notes?: string;
  price?: number; currency?: string; bought?: string; shop?: string; warranty?: string;
  qty?: number; placeId?: string;
  photos: string[]; // сжатые изображения (dataURL), первое — главное
  deleted?: boolean;
  created: number; updated: number;
}

export interface Place { id: string; name: string; parentId?: string; updated: number }
export interface Stock { id: string; name: string; category?: string; sku?: string; qty: number; unit: string; min: number; placeId?: string; notes?: string; photo?: string; deleted?: boolean; created: number; updated: number }
export interface Op { id: string; ts: number; kind: string; ref: string; refName: string; text: string }
export interface Cat { name: string }
export const UNITS = ['шт', 'компл', 'м', 'кг', 'г', 'л', 'мл', 'упак'];

class WorkshopDB extends Dexie {
  items!: Table<Item, string>;
  places!: Table<Place, string>; stock!: Table<Stock, string>; ops!: Table<Op, string>; cats!: Table<Cat, string>;
  constructor() {
    super('workshop-inventory');
    this.version(1).stores({ items: 'id,name,category,status,updated' });
    this.version(2).stores({ items: 'id,name,category,status,updated' }).upgrade(async tx => {
      await tx.table('items').toCollection().modify((item: Item & {status?:string;previousStatus?:string}) => {
        if (item.status === 'Выдан' || item.status === 'В работе' || item.status === 'На ремонте') {
          item.previousStatus = item.status;
          item.status = item.status === 'На ремонте' ? 'Неисправен' : 'В наличии';
        }
      });
    });
    this.version(3).stores({ items: 'id,name,category,updated' }).upgrade(async tx => {
      await tx.table('items').toCollection().modify((item: Record<string, unknown>) => {
        delete item.status;
        delete item.previousStatus;
      });
    });
    this.version(4).stores({
      items: 'id,name,category,updated,placeId',
      places: 'id,parentId', stock: 'id,name,placeId',
      ops: 'id,ts,ref', cats: 'name'
    }).upgrade(async tx => {
      await tx.table('items').toCollection().modify((item: Item) => {
        if (!Number.isFinite(item.qty) || (item.qty ?? 0) < 0) item.qty = 1;
      });
    });
  }
}
export const db = new WorkshopDB();

export const newItem = (): Item => ({
  id: crypto.randomUUID(), name: '', category: CATEGORIES[0], qty: 1, currency: 'RUB',
  photos: [], created: Date.now(), updated: Date.now()
});

export const newStock = (): Stock => ({ id: crypto.randomUUID(), name: '', qty: 0, unit: 'шт', min: 0, created: Date.now(), updated: Date.now() });
export const placePath = (places: Place[], id?: string): string => {
  const path: string[] = []; let node=places.find(x=>x.id===id); let hops=0;
  while(node && hops++<25){path.unshift(node.name);node=places.find(x=>x.id===node!.parentId);}
  return path.join(' → ');
};
export const logOp = (kind: string, ref: string, refName: string, text: string) => db.ops.add({ id:crypto.randomUUID(), ts:Date.now(), kind, ref, refName, text });
export const ensureCats = async () => {if(await db.cats.count()===0)await db.cats.bulkPut(CATEGORIES.map(name=>({name})));};
export type StockKind = 'Приход'|'Расход'|'Корректировка'|'Списание';
export function stockDelta(s:Stock,kind:StockKind,amount:number):number {return kind==='Приход'?amount:kind==='Корректировка'?amount-s.qty:-amount;}
export async function applyStock(id:string,kind:string,delta:number,note='') {
  if(!Number.isFinite(delta))throw Error('Некорректное количество');
  return db.transaction('rw',db.stock,db.ops,async()=>{
    const s=await db.stock.get(id);if(!s)throw Error('Расходник не найден');
    const qty=Math.round((s.qty+delta)*1000)/1000;
    if(qty<0)throw Error('Недостаточный остаток');
    await db.stock.update(id,{qty,updated:Date.now()});
    await logOp(kind,id,s.name,`${delta>0?'+':''}${delta} ${s.unit}, остаток ${qty}${note?' — '+note:''}`);
    return qty;
  });
}

// ---------- резервные копии ----------
export const BACKUP_VERSION = 2;

export function validateBackup(data: any): {items:Item[];places:Place[];stock:Stock[];ops:Op[];noPhotos:boolean} {
  if (!data || typeof data !== 'object' || data.app !== 'workshop-inventory' || !Array.isArray(data.items))
    throw new Error('Это не резервная копия Workshop Inventory');
  if (data.version > BACKUP_VERSION) throw new Error('Копия создана более новой версией приложения');
  const items: Item[] = data.items.map((i: any) => {
    if (typeof i?.id !== 'string' || typeof i?.name !== 'string') throw new Error('Повреждена запись в копии');
    const { status: _status, previousStatus: _previousStatus, ...clean } = i;
    return { ...newItem(), ...clean,
      photos: Array.isArray(i.photos) ? i.photos.filter((p: any) => typeof p === 'string' && p.startsWith('data:image/')) : [] } as Item;
  });
  return { items, places:Array.isArray(data.places)?data.places:[], stock:Array.isArray(data.stock)?data.stock:[],
    ops:Array.isArray(data.ops)?data.ops:[],noPhotos:!!data.noPhotos };
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
  const [items,places,stock,ops]=await Promise.all([db.items.toArray(),db.places.toArray(),db.stock.toArray(),db.ops.toArray()]);
  return JSON.stringify({ app:'workshop-inventory',version:BACKUP_VERSION,exported:new Date().toISOString(),items,places,stock,ops });
}

export async function importBackup(data: ReturnType<typeof validateBackup>) {
  const prevItems=await db.items.toArray();
  const incoming=data.noPhotos?data.items.map(i=>({...i,photos:prevItems.find(p=>p.id===i.id)?.photos??[]})):data.items;
  const r=mergeItems(prevItems,incoming);
  const oldStock=await db.stock.toArray();
  const stockUpdates=data.stock.filter(i=>{
    const old=oldStock.find(p=>p.id===i.id);
    return !old||(i.updated??0)>(old.updated??0);
  }).map(i=>data.noPhotos?{...i,photo:oldStock.find(p=>p.id===i.id)?.photo}:i);
  const oldPlaces=await db.places.toArray();
  const placeUpdates=data.places.filter(i=>{
    const old=oldPlaces.find(p=>p.id===i.id);return !old||(i.updated??0)>(old.updated??0);
  });
  await db.transaction('rw',db.items,db.stock,db.places,db.ops,async()=>{
    await db.items.bulkPut(r.toWrite);
    await db.stock.bulkPut(stockUpdates);
    await db.places.bulkPut(placeUpdates);
    const ids=new Set((await db.ops.toCollection().primaryKeys()) as string[]);
    await db.ops.bulkPut(data.ops.filter(o=>!ids.has(o.id)));
  });
  return r.added+stockUpdates.filter(i=>!oldStock.some(p=>p.id===i.id)).length+placeUpdates.filter(i=>!oldPlaces.some(p=>p.id===i.id)).length;
}
export const stockUrl = (id:string)=>location.origin+location.pathname+'#/s/'+id;

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