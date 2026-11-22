import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import QRCode from 'qrcode';
import {db,itemUrl,stockUrl} from './db';
import Icon from './Icon';

type Entry={id:string;name:string;kind:'i'|'s'};
export default function QrSheet(){
  const items=useLiveQuery(()=>db.items.filter(x=>!x.deleted).toArray(),[],[]);
  const stock=useLiveQuery(()=>db.stock.filter(x=>!x.deleted).toArray(),[],[]);
  const all:Entry[]=[
    ...items.map(i=>({id:i.id,name:i.name,kind:'i' as const})),
    ...stock.map(i=>({id:i.id,name:i.name,kind:'s' as const}))
  ].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const [selected,setSelected]=useState<string[]>([]);
  const [size,setSize]=useState(40);
  const [page,setPage]=useState<'a4'|'roll'>('a4');
  const [codes,setCodes]=useState<Record<string,string>>({});
  const chosen=all.filter(x=>selected.includes(x.id));
  useEffect(()=>{
    let stopped=false;
    Promise.all(chosen.map(async e=>[e.id,await QRCode.toDataURL(e.kind==='i'?itemUrl(e.id):stockUrl(e.id),{width:400,margin:2})] as const))
      .then(entries=>{if(!stopped)setCodes(Object.fromEntries(entries));})
      .catch(()=>{if(!stopped)setCodes({});});
    return()=>{stopped=true;};
  },[selected,items,stock]);
  const choose=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  return <><div className="page-head"><div><h1>Печать QR-наклеек</h1><p className="mut">Выберите несколько инструментов и расходников для печати на листе.</p></div><Link to="/qr" className="btn">К QR-кодам</Link></div>
    <div className="panel panel-body">
      <div className="qr-actions"><button onClick={()=>setSelected(all.map(e=>e.id))}>Выбрать все</button><button onClick={()=>setSelected([])}>Снять выбор</button>
      <label>Размер<select value={size} onChange={e=>setSize(+e.target.value)}>{[30,40,50,60].map(x=><option key={x} value={x}>{x} × {x} мм</option>)}</select></label>
      <label>Формат<select value={page} onChange={e=>setPage(e.target.value as 'a4'|'roll')}><option value="a4">Лист А4</option><option value="roll">Этикетки (рулон)</option></select></label>
      <button className="pri" disabled={!chosen.length||chosen.some(x=>!codes[x.id])} onClick={()=>window.print()}><Icon name="printer" size={18}/> Печать ({chosen.length})</button></div>
      {all.map(e=><label key={e.id} className="qr-check"><input type="checkbox" checked={selected.includes(e.id)} onChange={()=>choose(e.id)}/><Icon name={e.kind==='i'?'drill':'box'} size={19}/><span>{e.name}</span><small>{e.kind==='i'?'Инструмент':'Расходник'}</small></label>)}
      {!all.length&&<div className="empty"><Icon name="qr" size={40}/><h3>Пока нечего печатать</h3><Link className="btn pri" to="/new">Добавить первый инструмент</Link></div>}
    </div>
    <h2>Предпросмотр листа</h2><div className={'sheet '+page}>{chosen.map(e=><div key={e.id} className="label" style={{width:size+'mm',minHeight:size+'mm'}}>{codes[e.id]&&<img src={codes[e.id]} alt="QR-код"/>}<div>{e.name}</div><div>{e.id.slice(0,8)}</div></div>)}</div>
    <style>{page==='a4'?'@media print{@page{size:A4;margin:8mm}}':'@media print{@page{size:'+size+'mm '+size+'mm;margin:0}}'}</style>
  </>;
}
