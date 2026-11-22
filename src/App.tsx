import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { NavLink, Route, Routes, Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import Icon, {type IconName} from './Icon';
import {StockList, StockForm, StockCard} from './Stock';
import StoragePlaces from './Places';
import { db, Item, CATEGORIES, newItem, resizeImage, itemUrl, parseQr, exportBackup, validateBackup, mergeItems, importBackup, ensureCats, placePath, type Place } from './db';

let toastSet: (s: string) => void = () => {};
const toast = (s: string) => toastSet(s);

const menu: {to:string;icon:IconName;title:string}[] = [
  {to:'/',icon:'home',title:'Главная'},
  {to:'/catalog',icon:'drill',title:'Инструменты'},
  {to:'/stock',icon:'box',title:'Расходники / Склад'},
  {to:'/places',icon:'shelves',title:'Места хранения'},
  {to:'/qr',icon:'qr',title:'QR-коды'},
  {to:'/history',icon:'clock',title:'История операций'},
  {to:'/reports',icon:'chart',title:'Отчёты'},
  {to:'/settings',icon:'settings',title:'Настройки'}
];

function AddMenu(){
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const handler=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
   document.addEventListener('pointerdown',handler);return()=>document.removeEventListener('pointerdown',handler);},[open]);
 return <div className="add-menu" ref={ref}><button className="pri add-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu"><Icon name="plus" size={19}/> Добавить <Icon name="chevron" size={17}/></button>
 {open&&<div className="add-dropdown" role="menu"><Link role="menuitem" to="/new" onClick={()=>setOpen(false)}><Icon name="drill"/> Инструмент</Link>
   <Link role="menuitem" to="/stock/new" onClick={()=>setOpen(false)}><Icon name="box"/> Расходник</Link></div>}</div>;
}

function usePlaces(){ return useLiveQuery(()=>db.places.toArray(),[],[] as Place[]); }
const categoryColor=(cat:string)=>['#54b5ff','#fea04d','#bf90ff','#4bd8b6','#f5cf59','#60d4ee'][Math.abs([...cat].reduce((a,ch)=>a*31+ch.charCodeAt(0),0))%6];
export default function App() {
  const [msg, setMsg] = useState('');
  toastSet = (message) => { setMsg(message); window.setTimeout(() => setMsg(''), 2500); };
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'; ensureCats().catch(()=>{}); document.documentElement.dataset.accent = localStorage.getItem('accent')||'blue';
  }, []);
  return <div className="app-shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><span className="brand-mark"><img src={import.meta.env.BASE_URL+"favicon.svg"} alt="" width={42} height={42}/></span><span><strong>Workshop Inventory</strong><small>Учёт мастерской</small></span></Link>
      <div className="sidebar-line" aria-hidden="true" />
      <nav aria-label="Основное меню">
        {menu.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({isActive}) => isActive ? 'active' : ''}>
          <span className="nav-icon" aria-hidden="true"><Icon name={link.icon} size={21}/></span><span className="nav-title">{link.title}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-foot">
        <div className="foot-title">▣ Моя мастерская</div>
        <div className="mut foot-sub">● Локальная база (IndexedDB)</div>
        <div className="foot-pills"><span>Дизайн 1.0</span><span>PWA</span></div>
      </div>
    </aside>
    <main className="content">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/warehouse" element={<StockList />} />
        <Route path="/stock" element={<StockList />} />
        <Route path="/stock/new" element={<StockForm />} />
        <Route path="/stock/edit/:id" element={<StockForm />} />
        <Route path="/s/:id" element={<StockCard />} />
        <Route path="/places" element={<StoragePlaces />} />
        <Route path="/history" element={<History />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/new" element={<Form />} />
        <Route path="/i/:id" element={<Card />} />
        <Route path="/edit/:id" element={<Form />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/qr" element={<QRStudio />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Missing />} />
      </Routes>
    </main>
    {msg && <div className="toast" role="status">{msg}</div>}
  </div>;
}

const live = () => useLiveQuery(() => db.items.filter(i => !i.deleted).toArray(), [], undefined as Item[] | undefined);

const consumableCategories = new Set(['Расходные материалы', 'Крепёж', 'Запчасти', 'Электротовары', 'Оснастка']);
const displayDate = (time: number) => new Date(time).toLocaleDateString('ru-RU', {day:'2-digit',month:'short',year:'numeric'});
const categoryList = (items: Item[]) => CATEGORIES.map(name => ({ name, count: items.filter(i => i.category === name).length })).filter(x => x.count > 0).sort((a,b) => b.count - a.count);

function SectionHead({title, href}: {title:string;href?:string}) {
  return <div className="panel-head"><h2>{title}</h2>{href && <Link to={href}>Посмотреть все →</Link>}</div>;
}

function Home() {
  const items = live();
  const [query, setQuery] = useState('');
  const [hidden] = useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('hidden-widgets')||'[]');}catch{return [];}});
  const visible=(k:string)=>!hidden.includes(k);
  const nav = useNavigate();
  if (!items) return <div className="panel">Загрузка данных…</div>;
  const tools = items.filter(i => !consumableCategories.has(i.category));
  const consumables = items.filter(i => consumableCategories.has(i.category));
  const placesCount = new Set(items.map(i => i.place?.trim()).filter(Boolean)).size;
  const recent = [...items].sort((a,b) => b.updated - a.updated).slice(0,5);
  const categories = categoryList(items).slice(0,6);
  const max = Math.max(1,...categories.map(c=>c.count));
  return <>
    <div className="home-toolbar"><span>Обзор мастерской</span><AddMenu/></div>
    <header className="hero">
      <div><h1>Добро пожаловать в <em>Workshop Inventory!</em></h1><p>Учёт инструментов, оборудования и расходных материалов в вашей мастерской</p></div>
      <div className="hero-search"><span>⌕</span><input aria-label="Поиск инструментов" placeholder="Поиск инструментов, расходников, мест…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')nav('/catalog?q='+encodeURIComponent(query));}} /></div>
    </header>
    {visible("metrics")&&<section className="kpi-grid" aria-label="Обзор мастерской">
      <Link className="kpi" to="/catalog"><span className="kpi-icon blue"><Icon name="drill"/></span><span>Всего инструментов<strong>{tools.length}</strong></span></Link>
      <Link className="kpi" to="/stock"><span className="kpi-icon gold"><Icon name="box"/></span><span>Позиций расходников<strong>{consumables.length}</strong></span></Link>
      <Link className="kpi" to="/places"><span className="kpi-icon green"><Icon name="shelves"/></span><span>Мест хранения<strong>{placesCount}</strong></span></Link>
      <Link className="kpi" to="/reports"><span className="kpi-icon blue"><Icon name="chart"/></span><span>Всего позиций<strong>{items.length}</strong></span></Link>
    </section>}
    <section className="dashboard-middle">
      {visible("recent")&&<div className="panel">
        <SectionHead title="◷ Последние изменения" href="/history"/>
        <div className="panel-body">
          {recent.length === 0 ? <div className="empty"><Icon name="box" size={40}/><p>Предметов пока нет</p><Link className="btn pri" to="/new">Добавить первый инструмент</Link></div> : recent.map(i=><Link className="activity-line" key={i.id} to={'/i/'+i.id}><span className="activity-symbol">＋</span><span className="activity-description"><b>{i.name}</b><small>{i.category}{i.place?' · '+i.place:''}</small></span><time>{displayDate(i.updated)}</time></Link>)}
        </div>
      </div>}
      {visible("quick")&&<div className="panel">
        <SectionHead title="ϟ Быстрые действия"/>
        <div className="action-grid">
          <Link className="action primary-action" to="/new"><span><Icon name="plus"/></span>Добавить инструмент</Link>
          <Link className="action" to="/warehouse"><span>▣</span>Расходники</Link>
          <Link className="action" to="/qr"><span><Icon name="qr"/></span>Создать QR-код</Link>
          <Link className="action" to="/catalog"><span><Icon name="drill"/></span>Каталог</Link>
          <Link className="action" to="/places"><span><Icon name="shelves"/></span>Места хранения</Link>
          <Link className="action" to="/settings"><span><Icon name="download"/></span>Резервная копия</Link>
        </div>
      </div>}
      {visible("info")&&<div className="panel">
        <SectionHead title="♧ Информация"/>
        <div className="panel-body info-list">
          <div><span>▣</span><p><strong>Складские остатки</strong><small>Количественный учёт пока не подключён</small></p></div>
          <div><span>⌖</span><p><strong>Места хранения</strong><small>Указано мест: {placesCount}</small></p></div>
          <div><span>▦</span><p><strong>QR-наклейки</strong><small>Создаются в карточках предметов</small></p></div>
          <div><span>◉</span><p><strong>Сохранение данных</strong><small>На этом устройстве. Делайте резервные копии</small></p></div>
        </div>
      </div>}
    </section>
    {visible("charts")&&<section className="dashboard-bottom">
      <div className="panel">
        <SectionHead title="◴ Распределение по типам"/>
        <div className="distribution">
          <div className="donut" style={{background:items.length?'conic-gradient(#16dca5 0 '+(tools.length/items.length*100)+'%, #299cff 0 100%)':'conic-gradient(#243a56 0 100%)'}}><div><strong>{items.length}</strong><small>всего позиций</small></div></div>
          <div className="legend"><div><i className="green-dot"/>Инструменты и оборудование <b>{tools.length}</b></div><div><i className="blue-dot"/>Расходники <b>{consumables.length}</b></div></div>
        </div>
      </div>
      <div className="panel">
        <SectionHead title="▥ Топ категорий" href="/reports"/>
        <div className="panel-body category-bars">
          {categories.length ? categories.map(c=><div key={c.name} className="bar-line"><span>{c.name}</span><div className="bar-track"><div style={{width:(c.count/max*100)+'%'}}/></div><b>{c.count}</b></div>):<p className="mut">Категории появятся после добавления предметов.</p>}
        </div>
      </div>
    </section>}
  </>;
}

function Warehouse(){
  const items=live();
  const list=(items||[]).filter(i=>consumableCategories.has(i.category));
  return <><div className="page-head"><div><h1>Расходники / Склад</h1><p className="mut">Каталог расходных материалов и комплектующих</p></div><Link className="btn pri" to="/new">＋ Добавить</Link></div>
    <div className="panel panel-body"><p className="mut">Учёт количества, приходов и списаний будет добавлен отдельно. Сейчас доступны карточки, фотографии и QR-коды.</p></div>
    {list.length?list.map(i=><Row key={i.id} i={i}/>):<div className="panel panel-body mut">Пока нет расходников. Для новой позиции выберите категорию «Расходные материалы», «Крепёж» или «Запчасти».</div>}
  </>;
}
function Places(){
  const items=live();
  const grouped=new Map<string,Item[]>();
  (items||[]).forEach(i=>{const place=i.place?.trim();if(place)grouped.set(place,[...(grouped.get(place)||[]),i]);});
  return <><h1>Места хранения</h1><p className="mut">Места формируются автоматически из карточек инструментов.</p>
    {[...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([place,list])=><div className="panel" key={place}><SectionHead title={'⌖ '+place}/><div className="panel-body">{list.map(i=><Row key={i.id} i={i}/>)}</div></div>)}
    {!grouped.size&&<div className="panel panel-body mut">Пока не указано ни одного места хранения. Добавьте место в карточке предмета.</div>}
  </>;
}
function History(){
  const items=live();
  return <><h1>Последние изменения</h1><p className="mut">Список карточек по времени изменения. Подробный журнал операций пока не реализован.</p>
    {[...(items||[])].sort((a,b)=>b.updated-a.updated).map(i=><Link key={i.id} to={'/i/'+i.id} className="panel history-entry"><b>{i.name}</b><small>{i.category} · {new Date(i.updated).toLocaleString('ru-RU')}</small></Link>)}
    {!items?.length&&<div className="panel panel-body mut">Пока нет записей.</div>}
  </>;
}
function Reports(){
  const items=live();
  const list=categoryList(items||[]);
  const max=Math.max(1,...list.map(i=>i.count));
  return <><h1>Отчёты и статистика</h1><div className="kpi-grid"><div className="kpi"><span>Всего позиций<strong>{items?.length||0}</strong></span></div>
    <div className="kpi"><span>Категорий<strong>{list.length}</strong></span></div>
    <div className="kpi"><span>Мест хранения<strong>{new Set((items||[]).map(i=>i.place).filter(Boolean)).size}</strong></span></div></div>
    <div className="panel"><SectionHead title="▥ Количество по категориям"/><div className="panel-body category-bars">{list.map(c=><div className="bar-line" key={c.name}><span>{c.name}</span><div className="bar-track"><div style={{width:(c.count/max*100)+'%'}}/></div><b>{c.count}</b></div>)}{!list.length&&<p className="mut">Нет данных.</p>}</div></div>
  </>;
}

function Row({ i }: { i: Item }) {
  return <Link to={`/i/${i.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><div className="card row">
    {i.photos[0] ? <img src={i.photos[0]} alt="" /> : <div style={{ width: 64 }} />}
    <div><b>{i.name}</b><div className="mut">{[i.maker, i.model].filter(Boolean).join(' ')}</div>
      <span className="tag" style={{color:categoryColor(i.category),borderColor:categoryColor(i.category),background:categoryColor(i.category)+"22"}}>{i.category}</span></div></div></Link>;
}

function Catalog() {
  const items = live();
  const [q, setQ] = useState(new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '');
  const [cat, setCat] = useState(''); const [sort, setSort] = useState('name'); const [tiles, setTiles] = useState(false);
  if (!items) return null;
  const t = q.toLowerCase();
  const list = items.filter(i => (!cat || i.category === cat) &&
    (!t || [i.name, i.maker, i.model, i.category, i.place].some(v => v?.toLowerCase().includes(t))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ru') : b.updated - a.updated);
  return (<>
    <h1>Каталог</h1>
    <input placeholder="Поиск по названию, модели, номеру, месту…" value={q} onChange={e => setQ(e.target.value)} />
    <div className="row">
      <select value={cat} onChange={e => setCat(e.target.value)}><option value="">Все категории</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <select value={sort} onChange={e => setSort(e.target.value)}><option value="name">По названию</option><option value="upd">По дате изменения</option></select>
      <button onClick={() => setTiles(!tiles)} aria-label="Плитка или список">{tiles ? '☰' : '▦'}</button>
    </div>
    {list.length === 0 && <div className="card mut">Ничего не найдено.</div>}
    {tiles ? <div className="grid">{list.map(i => <Link key={i.id} to={`/i/${i.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
      <div className="card">{i.photos[0] ? <img className="thumb" src={i.photos[0]} alt="" /> : <div className="thumb" />}<b>{i.name}</b></div></Link>)}</div>
      : list.map(i => <Row key={i.id} i={i} />)}
  </>);
}

const F = (k: keyof Item, label: string, o: { type?: string; area?: boolean } = {}) => ({ k, label, ...o });
const FIELDS = [F('name', 'Название *'), F('maker', 'Производитель'), F('model', 'Модель'),
  F('place', 'Место хранения (например: Мастерская → Стеллаж 2 → Полка 3)'), F('notes', 'Примечания', { area: true })];

function Form() {
  const { id } = useParams(); const nav = useNavigate(); const places=usePlaces();
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
    <label>Место хранения из списка<select value={it.placeId??''} onChange={e=>set('placeId',e.target.value||undefined)}><option value="">— Не указано —</option>{places.map(p=><option key={p.id} value={p.id}>{placePath(places,p.id)}</option>)}</select></label>
    <label>Категория<select value={it.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
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
  const { id } = useParams(); const nav = useNavigate(); const places=usePlaces();
  const it = useLiveQuery(() => db.items.get(id!), [id]);
  const [qr, setQr] = useState(''); const [size, setSize] = useState(40); const [big, setBig] = useState('');
  useEffect(() => { if (id) QRCode.toDataURL(itemUrl(id), { width: 512, margin: 2 }).then(setQr); }, [id]);
  if (it === undefined) return null;
  if (!it) return <Missing />;
  const upd = (p: Partial<Item>) => db.items.update(it.id, { ...p, updated: Date.now() });
  const del = async () => { if (confirm('Удалить предмет? Его можно будет восстановить в настройках.')) { await upd({ deleted: true }); toast('Удалено'); nav('/catalog'); } };
  const rows: [string, any][] = [['Категория', it.category], ['Производитель', it.maker], ['Модель', it.model],
    ['Место', placePath(places,it.placeId)||it.place], ['Примечания', it.notes], ['Добавлено', new Date(it.created).toLocaleString('ru')], ['Изменено', new Date(it.updated).toLocaleString('ru')]];
  return (<>
    <h1>{it.name}</h1>
    {it.deleted && <div className="card dng">Предмет удалён. <button onClick={() => upd({ deleted: false })}>Восстановить</button></div>}
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

function QRStudio() {
  const items = live();
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [size, setSize] = useState(40);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const active = items?.find(i => i.id === selectedId);
  useEffect(() => {
    let cancelled = false;
    setQr('');
    setError('');
    if (!selectedId || !active) return;
    QRCode.toDataURL(itemUrl(selectedId), { width: 768, margin: 3, errorCorrectionLevel: 'M' })
      .then(value => { if (!cancelled) setQr(value); })
      .catch(() => { if (!cancelled) setError('Не удалось создать QR-код'); });
    return () => { cancelled = true; };
  }, [selectedId, active?.id]);
  const filtered = [...(items || [])].filter(i =>
    [i.name, i.maker, i.model, i.place].some(v => (v || '').toLowerCase().includes(search.toLowerCase()))
  ).sort((a,b) => a.name.localeCompare(b.name,'ru'));
  const print = () => {
    if (!qr || !active) return;
    window.print();
  };
  return <>
    <div className="page-head">
      <div><h1>Создать QR-код</h1><p className="mut">Выберите предмет, скачайте код или распечатайте наклейку.</p></div>
      <Link className="btn" to="/scan">▦ Сканировать QR</Link>
    </div>
    <div className="qr-layout">
      <div className="panel">
        <SectionHead title="1. Выбор предмета"/>
        <div className="panel-body">
          <label htmlFor="qr-search">Найти инструмент или расходник</label>
          <input id="qr-search" placeholder="Название, модель или место хранения…" value={search} onChange={e=>setSearch(e.target.value)} />
          <div className="qr-item-list">
            {filtered.map(i=><button key={i.id} type="button" className={'qr-item-choice'+(i.id===selectedId?' selected':'')} onClick={()=>setSelectedId(i.id)}>
              {i.photos[0]?<img src={i.photos[0]} alt="" />:<span className="qr-placeholder">⚒</span>}
              <span><strong>{i.name}</strong><small>{i.category}</small></span><span aria-hidden="true">{i.id===selectedId?'●':'○'}</span>
            </button>)}
            {!filtered.length&&<p className="mut">Предметы не найдены. Сначала создайте карточку.</p>}
          </div>
          <Link className="btn pri" to="/new">＋ Добавить новый предмет</Link>
        </div>
      </div>
      <div className="panel">
        <SectionHead title="2. QR-наклейка"/>
        <div className="panel-body">
          {active ? <>
            <div className="qr-preview">
              {qr?<img src={qr} alt={'QR-код: '+active.name}/>:<p className="mut">{error||'Создание QR-кода…'}</p>}
              <strong>{active.name}</strong>
              <small>№ {active.id.slice(0,8)}</small>
            </div>
            <p className="mut qr-tip">QR ведёт к постоянной карточке предмета. Если открыть его на другом устройстве, данные карточки должны быть предварительно перенесены туда через резервную копию.</p>
            <label htmlFor="qr-size">Размер наклейки</label>
            <select id="qr-size" value={size} onChange={e=>setSize(Number(e.target.value))}>
              {[30,40,50,60].map(mm=><option value={mm} key={mm}>{mm} × {mm} мм</option>)}
            </select>
            <div className="qr-actions">
              <a className={'btn pri'+(!qr?' disabled':'')} aria-disabled={!qr} href={qr||undefined} download={'workshop-qr-'+active.id.slice(0,8)+'.png'} onClick={e=>{if(!qr)e.preventDefault();}}>↓ Скачать PNG</a>
              <button onClick={print} disabled={!qr}>▤ Печать наклейки</button>
              <Link className="btn" to={'/i/'+active.id}>Открыть карточку</Link>
            </div>
          </>:<div className="qr-empty"><span>▦</span><p>Выберите инструмент или расходник слева, чтобы создать QR-код.</p></div>}
        </div>
      </div>
    </div>
    {active&&qr&&<div className="label" style={{width:size+'mm',minHeight:size+'mm'}}>
      <img src={qr} alt="QR"/><div>{active.name}</div><div>{active.id.slice(0,8)}</div>
    </div>}
  </>;
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
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark');
  const [accent,setAccent] = useState(localStorage.getItem('accent')||'blue');
  const [hidden,setHidden] = useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('hidden-widgets')||'[]');}catch{return [];}});
  const changeAccent=(c:string)=>{setAccent(c);document.documentElement.dataset.accent=c;localStorage.setItem('accent',c);};
  const toggleWidget=(w:string)=>setHidden(current=>{const next=current.includes(w)?current.filter(x=>x!==w):[...current,w];localStorage.setItem('hidden-widgets',JSON.stringify(next));return next;});
  const toggle = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
  const exp = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' })); a.download = `workshop-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); toast('Копия создана'); };
  const imp = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const backup = validateBackup(JSON.parse(await f.text()));
      if (!confirm(`В копии: предметов ${backup.items.length}, расходников ${backup.stock.length}, мест ${backup.places.length}. Существующие записи не удаляются. Продолжить?`)) return;
      const added=await importBackup(backup); toast(`Импорт выполнен, новых записей: ${added}`);
    } catch (err: any) { toast(err.message || 'Ошибка импорта'); }
    e.target.value = '';
  };
  return (<><h1>Настройки</h1>
    <div className="card"><h3>Внешний вид</h3><button onClick={toggle}>Тема: {theme === 'dark' ? 'тёмная' : 'светлая'}</button>
      <p>Акцентный цвет</p>{[['blue','Синий'],['orange','Оранжевый'],['green','Зелёный']].map(([key,name])=><button key={key} className={accent===key?'pri':''} onClick={()=>changeAccent(key)}>{name}</button>)}
      <h3>Виджеты главной</h3>{[['metrics','Статистика'],['recent','Последние изменения'],['quick','Быстрые действия'],['info','Информация'],['charts','Диаграммы']].map(([k,name])=><label className="row" key={k}><input type="checkbox" style={{width:24}} checked={!hidden.includes(k)} onChange={()=>toggleWidget(k)}/>{name}</label>)}
    </div>
    <div className="card"><h3>Резервная копия</h3><p className="mut">Данные хранятся только на этом устройстве. Делайте копии регулярно.</p>
      <button className="pri" onClick={exp}>Скачать копию (JSON)</button><input type="file" accept="application/json" onChange={imp} /></div>
    <div className="card"><h3>Удалённые ({del?.length || 0})</h3>{del?.map(i => <div key={i.id} className="row">{i.name}<button onClick={() => db.items.update(i.id, { deleted: false, updated: Date.now() })}>Восстановить</button></div>)}</div></>);
}

function Missing() { return <div className="card"><h2>Не найдено</h2><p>Такой карточки нет на этом устройстве.</p><Link className="btn" to="/">На главную</Link></div>; }