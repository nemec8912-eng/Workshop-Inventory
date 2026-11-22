import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { db, Stock, Place, UNITS, newStock, resizeImage, placePath, stockDelta, applyStock, logOp, type StockKind } from './db';
import Icon from './Icon';

const notify = (message:string) => window.alert(message);
const usePlaces = () => useLiveQuery(()=>db.places.toArray(),[],[] as Place[]);
export const stockLink = (id:string) => location.origin+location.pathname+'#/s/'+id;

export function StockList(){
  const list=useLiveQuery(()=>db.stock.filter(s=>!s.deleted).toArray(),[],[] as Stock[]);
  const [query,setQuery]=useState('');const [low,setLow]=useState(false);
  const swipe=useRef({x:0,y:0});
  const adjust=async (s:Stock,d:number)=>{
    try{await applyStock(s.id,d>0?'Приход':'Расход',d); }catch(e){notify(e instanceof Error?e.message:'Ошибка операции');}
  };
  const found=list.filter(s=>(!low||(s.min>0&&s.qty<=s.min))&&[s.name,s.category,s.sku].some(v=>v?.toLowerCase().includes(query.toLowerCase())));
  return <><div className="page-head"><div><h1>Расходники и склад</h1><p className="mut">Учёт количества, приходов и расхода комплектующих</p></div><Link className="btn pri" to="/stock/new"><Icon name="plus" size={18}/> Добавить расходник</Link></div>
    <div className="panel panel-body"><input placeholder="Найти расходник…" value={query} onChange={e=>setQuery(e.target.value)}/><label className="row"><input type="checkbox" style={{width:22}} checked={low} onChange={e=>setLow(e.target.checked)}/>Только с низким остатком</label><p className="mut">На телефоне: вправо — приход +1, влево — расход −1.</p></div>
    {found.map(s=><div className="card stock-row" key={s.id} onTouchStart={e=>swipe.current={x:e.touches[0].clientX,y:e.touches[0].clientY}} onTouchEnd={e=>{const t=e.changedTouches[0],dx=t.clientX-swipe.current.x,dy=t.clientY-swipe.current.y;if(Math.abs(dx)>90&&Math.abs(dy)<35)void adjust(s,dx>0?1:-1);}}>
      <Link to={'/s/'+s.id} className="stock-detail">{s.photo?<img src={s.photo} alt=""/>:<span className="stock-icon"><Icon name="box"/></span>}<span><b>{s.name}</b><small>{s.category||'Расходные материалы'}</small><strong className={s.min>0&&s.qty<=s.min?'dng':''}>{s.qty} {s.unit}{s.min>0&&s.qty<=s.min?' · нужно пополнить':''}</strong></span></Link>
      <div className="stock-buttons"><button aria-label={'Расход '+s.name} onClick={()=>void adjust(s,-1)}>−</button><button className="pri" aria-label={'Приход '+s.name} onClick={()=>void adjust(s,1)}>＋</button></div></div>)}
    {found.length===0&&<div className="panel panel-body empty"><Icon name="box" size={42}/><h3>{list.length?'Ничего не найдено':'Расходников пока нет'}</h3><p className="mut">Добавьте первую позицию, чтобы учитывать остатки.</p><Link className="btn pri" to="/stock/new">Добавить расходник</Link></div>}
  </>;
}

export function StockForm(){
  const {id}=useParams();const nav=useNavigate();const places=usePlaces();
  const [item,setItem]=useState<Stock|null>(null);
  useEffect(()=>{(id?db.stock.get(id):Promise.resolve(newStock())).then(s=>setItem(s??null));},[id]);
  if(!item)return <div className="panel panel-body">Загрузка…</div>;
  const put=(p:Partial<Stock>)=>setItem({...item,...p});
  const save=async()=>{
    if(!item.name.trim())return notify('Укажите название расходника');
    if(!Number.isFinite(item.qty)||item.qty<0||!Number.isFinite(item.min)||item.min<0)return notify('Количество должно быть неотрицательным');
    try{await db.stock.put({...item,name:item.name.trim(),updated:Date.now()});
      if(!id)await logOp('Создание',item.id,item.name,'Добавлен расходник');
      nav('/s/'+item.id);
    }catch{notify('Ошибка сохранения');}
  };
  const photo=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)try{put({photo:await resizeImage(f,960)});}catch{notify('Не удалось открыть фото');}};
  return <><h1>{id?'Редактирование расходника':'Новый расходник'}</h1><div className="panel panel-body editor">
    <label>Название *<input value={item.name} onChange={e=>put({name:e.target.value})}/></label>
    <label>Категория<input value={item.category??''} onChange={e=>put({category:e.target.value})} placeholder="Например: Крепёж, Запчасти…"/></label>
    <label>Артикул<input value={item.sku??''} onChange={e=>put({sku:e.target.value})}/></label>
    {!id&&<label>Начальное количество<input type="number" min="0" step="any" value={item.qty} onChange={e=>put({qty:+e.target.value})}/></label>}
    <label>Единица измерения<select value={item.unit} onChange={e=>put({unit:e.target.value})}>{UNITS.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Минимальный остаток<input type="number" min="0" step="any" value={item.min} onChange={e=>put({min:+e.target.value})}/></label>
    <label>Место хранения<select value={item.placeId??''} onChange={e=>put({placeId:e.target.value||undefined})}><option value="">— не указано —</option>{places.map(p=><option value={p.id} key={p.id}>{placePath(places,p.id)}</option>)}</select></label>
    <label>Примечания<textarea value={item.notes??''} onChange={e=>put({notes:e.target.value})}/></label>
    <label>Фото<input type="file" accept="image/*" onChange={photo}/></label>{item.photo&&<img src={item.photo} alt="Фото расходника" className="thumb" style={{maxWidth:300}}/>}
    <button className="pri" onClick={()=>void save()}>Сохранить</button><button onClick={()=>nav(-1)}>Отмена</button>
  </div></>;
}

export function StockCard(){
  const {id}=useParams();const nav=useNavigate();const places=usePlaces();
  const s=useLiveQuery(()=>db.stock.get(id!),[id]);
  const ops=useLiveQuery(()=>db.ops.where('ref').equals(id!).reverse().sortBy('ts'),[id],[]);
  const [kind,setKind]=useState<StockKind>('Расход');const [count,setCount]=useState('');const [qr,setQr]=useState('');const [size,setSize]=useState(40);
  useEffect(()=>{if(id)QRCode.toDataURL(stockLink(id),{width:512,margin:2}).then(setQr).catch(()=>setQr(''));},[id]);
  if(s===undefined)return <div className="panel panel-body">Загрузка…</div>;
  if(!s)return <div className="panel panel-body">Расходник не найден.</div>;
  const execute=async()=>{const amount=Number(count);if(count.trim()===''||!Number.isFinite(amount)||amount<0||(amount===0&&kind!=='Корректировка'))return notify('Введите правильное количество');
    const delta=stockDelta(s,kind,amount);
    try{await applyStock(s.id,kind,delta);setCount('');}catch(e){notify(e instanceof Error?e.message:'Ошибка');}
  };
  const remove=async()=>{if(!confirm('Удалить расходник? Его можно восстановить в настройках.'))return;await db.stock.update(s.id,{deleted:true,updated:Date.now()});await logOp('Удаление',s.id,s.name,'Расходник удалён');nav('/stock');};
  return <><div className="page-head"><h1>{s.name}</h1><Link className="btn" to="/stock">К списку</Link></div>
    {s.photo&&<img className="thumb" src={s.photo} alt="" style={{maxWidth:340}}/>}
    <div className="panel panel-body"><div className="stat">{s.qty} {s.unit}</div><p className="mut">Категория: {s.category||'Расходные материалы'}</p>{s.sku&&<p>Артикул: {s.sku}</p>}{s.placeId&&<p>Место: {placePath(places,s.placeId)}</p>}{s.notes&&<p>{s.notes}</p>}{s.min>0&&s.qty<=s.min&&<p className="dng">Остаток ниже минимума ({s.min} {s.unit})</p>}</div>
    <div className="panel panel-body"><h2>Изменить остаток</h2><label>Операция<select value={kind} onChange={e=>setKind(e.target.value as StockKind)}>{['Приход','Расход','Корректировка','Списание'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>{kind==='Корректировка'?'Новый остаток':'Количество'}<input type="number" min="0" step="any" value={count} onChange={e=>setCount(e.target.value)}/></label><button className="pri" onClick={()=>void execute()}>Сохранить операцию</button></div>
    <div className="panel panel-body"><h2>QR-код</h2>{qr&&<img src={qr} alt="QR" width={170}/>}<div><a className="btn" href={qr||undefined} download={'qr-stock-'+s.id.slice(0,8)+'.png'}>Скачать PNG</a><select style={{width:'auto'}} value={size} onChange={e=>setSize(+e.target.value)}>{[30,40,50,60].map(x=><option key={x} value={x}>{x} × {x} мм</option>)}</select><button disabled={!qr} onClick={()=>window.print()}>Печать</button></div></div>
    <div className="label" style={{width:size+'mm',height:size+'mm'}}><img src={qr} alt=""/><div>{s.name}</div><div>{s.id.slice(0,8)}</div></div>
    <div className="panel panel-body"><h2>История</h2>{ops.map(o=><div key={o.id} className="history-entry">{o.kind}: {o.text}<small>{new Date(o.ts).toLocaleString('ru-RU')}</small></div>)}</div>
    <Link className="btn pri" to={'/stock/edit/'+s.id}>Редактировать</Link><button className="dng" onClick={()=>void remove()}>Удалить</button>
  </>;
}
