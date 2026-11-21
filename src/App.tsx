import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { NavLink, Route, Routes, Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { db, Item, STATUSES, CATEGORIES, newItem, resizeImage, itemUrl, parseQr, exportBackup, validateBackup, mergeItems } from './db';

let toastSet: (s: string) => void = () => {};
const toast = (s: string) => toastSet(s);

export default function App() {
  const [msg, setMsg] = useState('');
  toastSet = (s) => { setMsg(s); setTimeout(() => setMsg(''), 2500); };
  useEffect(() => { document.documentElement.dataset.theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }, []);
  return (<>
    <nav>
      <NavLink to="/">Главная</NavLink><NavLink to="/catalog">Каталог</NavLink>
      <NavLink to="/new">＋ Добавить</NavLink><NavLink to="/scan">Скан QR</NavLink><NavLink to="/settings">Настройки</NavLink>
    </nav>
    <main>
      <Routes>
        <Route path="/" element={<Home />} /><Route path="/catalog" element={<Catalog />} />
        <Route path="/new" element={<Form />} /><Route path="/i/:id" element={<Card />} />
        <Route path="/edit/:id" element={<Form />} /><Route path="/scan" element={<Scan />} />
        <Route path="/settings" element={<Settings />} /><Route path="*" element={<Missing />} />
      </Routes>
    </main>
    {msg && <div className="toast" role="status">{msg}</div>}
  </>);
}

const live = () => useLiveQuery(() => db.items.filter(i => !i.deleted).toArray(), [], undefined as Item[] | undefined);

function Home() {
  const items = live(); const [q, setQ] = useState(''); const nav = useNavigate();
  if (!items) return null;
  const n = (f: (i: Item) => boolean) => items.filter(f).length;
  const recent = [...items].sort((a, b) => b.created - a.created).slice(0, 5);
  return (<>
    <h1>Мастерская</h1>
    <input placeholder="Быстрый поиск…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && nav('/catalog?q=' + encodeURIComponent(q))} />
    <div className="grid">
      <div className="card"><div className="stat">{items.length}</div>Всего предметов</div>
      <div className="card"><div className="stat">{n(i => i.category === 'Электроинструменты')}</div>Электроинструменты</div>
      <div className="card"><div className="stat">{n(i => i.category === 'Станки и оборудование')}</div>Оборудование</div>
      <div className="card"><div className="stat">{n(i => i.status === 'На ремонте')}</div>На ремонте</div>
      <div className="card"><div className="stat">{n(i => i.status === 'Выдан')}</div>Выдано</div>
    </div>
    <h2>Недавно добавлено</h2>
    {recent.length === 0 && <div className="card mut">Пока пусто. Нажмите «＋ Добавить», чтобы создать первую карточку.</div>}
    {recent.map(i => <Row key={i.id} i={i} />)}
  </>);
}

function Row({ i }: { i: Item }) {
  return <Link to={`/i/${i.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><div className="card row">
    {i.photos[0] ? <img src={i.photos[0]} alt="" /> : <div style={{ width: 64 }} />}
    <div><b>{i.name}</b><div className="mut">{[i.maker, i.model].filter(Boolean).join(' ')}</div>
      <span className="tag">{i.category}</span> <span className="tag">{i.status}</span></div></div></Link>;
}

function Catalog() {
  const items = live();
  const [q, setQ] = useState(new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '');
  const [cat, setCat] = useState(''); const [st, setSt] = useState(''); const [sort, setSort] = useState('name'); const [tiles, setTiles] = useState(false);
  if (!items) return null;
  const t = q.toLowerCase();
  const list = items.filter(i => (!cat || i.category === cat) && (!st || i.status === st) &&
    (!t || [i.name, i.maker, i.model, i.serial, i.invNo, i.category, i.place].some(v => v?.toLowerCase().includes(t))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ru') : b.updated - a.updated);
  return (<>
    <h1>Каталог</h1>
    <input placeholder="Поиск по названию, модели, номеру, месту…" value={q} onChange={e => setQ(e.target.value)} />
    <div className="row">
      <select value={cat} onChange={e => setCat(e.target.value)}><option value="">Все категории</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <select value={st} onChange={e => setSt(e.target.value)}><option value="">Все статусы</option>{STATUSES.map(c => <option key={c}>{c}</option>)}</select>
      <select value={sort} onChange={e => setSort(e.target.value)}><option value="name">По названию</option><option value="upd">По дате изменения</option></select>
      <button onClick={() => setTiles(!tiles)} aria-label="Плитка или список">{tiles ? '☰' : '▦'}</button>
    </div>
    {list.length === 0 && <div className="card mut">Ничего не найдено.</div>}
    {tiles ? <div className="grid">{list.map(i => <Link key={i.id} to={`/i/${i.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
      <div className="card">{i.photos[0] ? <img className="thumb" src={i.photos[0]} alt="" /> : <div className="thumb" />}<b>{i.name}</b><div className="mut">{i.status}</div></div></Link>)}</div>
      : list.map(i => <Row key={i.id} i={i} />)}
  </>);
}

const F = (k: keyof Item, label: string, o: { type?: string; area?: boolean } = {}) => ({ k, label, ...o });
const FIELDS = [F('name', 'Название *'), F('maker', 'Производитель'), F('model', 'Модель'), F('serial', 'Серийный номер'), F('invNo', 'Инвентарный номер'),
  F('place', 'Место хранения (например: Мастерская → Стеллаж 2 → Полка 3)'), F('price', 'Цена покупки', { type: 'number' }), F('bought', 'Дата покупки', { type: 'date' }),
  F('shop', 'Магазин / поставщик'), F('warranty', 'Гарантия до', { type: 'date' }), F('desc', 'Описание', { area: true }), F('notes', 'Примечания', { area: true })];

function Form() {
  const { id } = useParams(); const nav = useNavigate();
  const [it, setIt] = useState<Item | null>(null);
  useEffect(() => { (id ? db.items.get(id) : Promise.resolve(newItem())).then(x => setIt(x ?? null)); }, [id]);
  if (!it) return <div className="card">Загрузка…</div>;
  const set = (k: keyof Item, v: any) => setIt({ ...it, [k]: v });
  const addPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    try { const p = await Promise.all([...(e.target.files || [])].map(f => resizeImage(f))); set('photos', [...it.photos, ...p]); }
    catch (err: any) { toast(err.message); }
  };
  const save = async () => {
    if (!it.name.trim()) return toast('Укажите название');
    try { await db.items.put({ ...it, name: it.name.trim(), updated: Date.now() }); toast('Сохранено'); nav(`/i/${it.id}`); }
    catch { toast('Не удалось сохранить: возможно, закончилось место в хранилище'); }
  };
  return (<>
    <h1>{id ? 'Редактирование' : 'Новый предмет'}</h1>
    <label>Категория<select value={it.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Статус<select value={it.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(c => <option key={c}>{c}</option>)}</select></label>
    {FIELDS.map(f => <label key={f.k}>{f.label}{f.area
      ? <textarea rows={3} value={(it[f.k] as string) ?? ''} onChange={e => set(f.k, e.target.value)} />
      : <input type={f.type} value={(it[f.k] as any) ?? ''} onChange={e => set(f.k, f.type === 'number' ? (e.target.value === '' ? undefined : +e.target.value) : e.target.value)} />}</label>)}
    <div>Фото (первое — главное)</div>
    <input type="file" accept="image/*" multiple onChange={addPhotos} />
    <div className="grid">{it.photos.map((p, n) => <div key={n} className="card"><img className="thumb" src={p} alt="" />
      {n > 0 && <button onClick={() => set('photos', [p, ...it.photos.filter((_, j) => j !== n)])}>Сделать главным</button>}
      <button className="dng" onClick={() => set('photos', it.photos.filter((_, j) => j !== n))}>Удалить</button></div>)}</div>
    <button className="pri" onClick={save}>Сохранить</button> <button onClick={() => nav(-1)}>Отмена</button>
  </>);
}

function Card() {
  const { id } = useParams(); const nav = useNavigate();
  const it = useLiveQuery(() => db.items.get(id!), [id]);
  const [qr, setQr] = useState(''); const [size, setSize] = useState(40); const [big, setBig] = useState('');
  useEffect(() => { if (id) QRCode.toDataURL(itemUrl(id), { width: 512, margin: 2 }).then(setQr); }, [id]);
  if (it === undefined) return null;
  if (!it) return <Missing />;
  const upd = (p: Partial<Item>) => db.items.update(it.id, { ...p, updated: Date.now() });
  const del = async () => { if (confirm('Удалить предмет? Его можно будет восстановить в настройках.')) { await upd({ deleted: true }); toast('Удалено'); nav('/catalog'); } };
  const rows: [string, any][] = [['Категория', it.category], ['Производитель', it.maker], ['Модель', it.model], ['Серийный номер', it.serial], ['Инв. номер', it.invNo],
    ['Место', it.place], ['Цена', it.price != null ? `${it.price} ${it.currency || ''}` : ''], ['Куплено', it.bought], ['Магазин', it.shop], ['Гарантия до', it.warranty],
    ['Описание', it.desc], ['Примечания', it.notes], ['Добавлено', new Date(it.created).toLocaleString('ru')], ['Изменено', new Date(it.updated).toLocaleString('ru')]];
  return (<>
    <h1>{it.name}</h1>
    {it.deleted && <div className="card dng">Предмет удалён. <button onClick={() => upd({ deleted: false })}>Восстановить</button></div>}
    <label>Статус<select value={it.status} onChange={e => upd({ status: e.target.value as any })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
    <div className="grid">{it.photos.map((p, n) => <img key={n} className="thumb" src={p} alt="" onClick={() => setBig(p)} />)}</div>
    <div className="card">{rows.filter(r => r[1]).map(([k, v]) => <div key={k}><span className="mut">{k}: </span>{v}</div>)}</div>
    <div className="card"><h3>QR-код</h3>
      {qr && <img src={qr} alt="QR-код" width={160} />}<div className="mut">ID: {it.id.slice(0, 8)}</div>
      <a className="btn" href={qr} download={`qr-${it.id.slice(0, 8)}.png`}>Скачать PNG</a>
      <select value={size} onChange={e => setSize(+e.target.value)} style={{ width: 'auto' }}>{[30, 40, 50].map(s => <option key={s} value={s}>{s}×{s} мм</option>)}</select>
      <button onClick={() => window.print()}>Печать наклейки</button></div>
    <div className="label" style={{ width: `${size}mm`, height: `${size}mm` }}><img src={qr} alt="" /><div>{it.name}</div><div>{it.id.slice(0, 8)}</div></div>
    <Link className="btn pri" to={`/edit/${it.id}`}>Редактировать</Link><button className="dng" onClick={del}>Удалить</button>
    {big && <div onClick={() => setBig('')} style={{ position: 'fixed', inset: 0, background: '#000d', zIndex: 8, display: 'grid', placeItems: 'center' }}><img src={big} style={{ maxWidth: '95%', maxHeight: '95%' }} alt="" /></div>}
  </>);
}

function Scan() {
  const nav = useNavigate(); const [err, setErr] = useState(''); const [code, setCode] = useState(''); const sc = useRef<Html5Qrcode | null>(null);
  const open = async (text: string) => {
    const id = parseQr(text.trim()); if (!id) return setErr('Это не код Workshop Inventory');
    const x = await db.items.get(id); if (!x) return setErr('Предмет не найден на этом устройстве. Данные хранятся локально на каждом устройстве.');
    nav(`/i/${id}`);
  };
  useEffect(() => {
    const s = new Html5Qrcode('reader'); sc.current = s;
    s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, t => { s.stop().catch(() => {}); open(t); }, () => {})
      .catch(() => setErr('Нет доступа к камере. Разрешите камеру в настройках браузера или введите код вручную.'));
    return () => { s.isScanning && s.stop().catch(() => {}); };
  }, []);
  return (<><h1>Сканер QR</h1><div id="reader" /><p className="dng">{err}</p>
    <input placeholder="Код или ссылка вручную" value={code} onChange={e => setCode(e.target.value)} /><button className="pri" onClick={() => open(code)}>Открыть</button></>);
}

function Settings() {
  const del = useLiveQuery(() => db.items.filter(i => !!i.deleted).toArray(), [], [] as Item[]);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  const toggle = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
  const exp = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' })); a.download = `workshop-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); toast('Копия создана'); };
  const imp = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const incoming = validateBackup(JSON.parse(await f.text())); const r = mergeItems(await db.items.toArray(), incoming);
      if (!confirm(`Будет добавлено: ${r.added}, обновлено: ${r.updated}. Существующие записи не удаляются. Продолжить?`)) return;
      await db.items.bulkPut(r.toWrite); toast('Импорт выполнен');
    } catch (err: any) { toast(err.message || 'Ошибка импорта'); }
    e.target.value = '';
  };
  return (<><h1>Настройки</h1>
    <div className="card"><button onClick={toggle}>Тема: {theme === 'dark' ? 'тёмная' : 'светлая'}</button></div>
    <div className="card"><h3>Резервная копия</h3><p className="mut">Данные хранятся только на этом устройстве. Делайте копии регулярно.</p>
      <button className="pri" onClick={exp}>Скачать копию (JSON)</button><input type="file" accept="application/json" onChange={imp} /></div>
    <div className="card"><h3>Удалённые ({del?.length || 0})</h3>{del?.map(i => <div key={i.id} className="row">{i.name}<button onClick={() => db.items.update(i.id, { deleted: false, updated: Date.now() })}>Восстановить</button></div>)}</div></>);
}

function Missing() { return <div className="card"><h2>Не найдено</h2><p>Такой карточки нет на этом устройстве.</p><Link className="btn" to="/">На главную</Link></div>; }