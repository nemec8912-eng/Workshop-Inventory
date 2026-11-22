import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Place, placePath } from './db';
import Icon from './Icon';

export default function Places(){
 const places=useLiveQuery(()=>db.places.toArray(),[],[] as Place[]);
 const items=useLiveQuery(()=>db.items.filter(i=>!i.deleted).toArray(),[],[]);
 const stock=useLiveQuery(()=>db.stock.filter(i=>!i.deleted).toArray(),[],[]);
 const [parent,setParent]=useState('');const [name,setName]=useState('');
 const add=async()=>{const n=name.trim();if(!n)return;await db.places.add({id:crypto.randomUUID(),name:n,parentId:parent||undefined,updated:Date.now()});setName('');};
 const remove=async(p:Place)=>{
   if(places.some(x=>x.parentId===p.id)||items.some(x=>x.placeId===p.id)||stock.some(x=>x.placeId===p.id))return alert('В этом месте есть вложенные места или предметы. Сначала переместите их.');
   if(confirm('Удалить пустое место «'+p.name+'»?'))await db.places.delete(p.id);
 };
 return <><div className="page-head"><div><h1>Места хранения</h1><p className="mut">Мастерская → Шкаф → Полка. Выбирайте место в карточках предметов.</p></div></div>
 <div className="panel panel-body"><h2>Создать место хранения</h2><label>Внутри<select value={parent} onChange={e=>setParent(e.target.value)}><option value="">Мастерская (корень)</option>{places.map(p=><option key={p.id} value={p.id}>{placePath(places,p.id)}</option>)}</select></label>
 <label>Название<input value={name} onChange={e=>setName(e.target.value)} placeholder="Например: Шкаф №2, Ящик №3"/></label><button className="pri" onClick={()=>void add()}><Icon name="plus" size={18}/> Создать место</button></div>
 <div className="places-grid">{[...places].sort((a,b)=>placePath(places,a.id).localeCompare(placePath(places,b.id),'ru')).map(p=>{
  const count=items.filter(x=>x.placeId===p.id).length+stock.filter(x=>x.placeId===p.id).length;
  return <div className="panel location-tile" key={p.id}><div className="loc-icon"><Icon name="shelves" size={29}/></div><h3>{p.name}</h3><p className="mut">{placePath(places,p.id)}</p><p>{count} позиций непосредственно здесь</p>
    <Link className="btn" to={'/catalog?place='+p.id}>Посмотреть инструменты</Link><button onClick={()=>void remove(p)}>Удалить</button>
  </div>})}</div>
 {!places.length&&<div className="panel panel-body empty"><Icon name="shelves" size={42}/><h3>Мест хранения ещё нет</h3><p className="mut">Создайте шкаф, стеллаж или полку, чтобы распределить инструменты и расходники.</p></div>}
 </>;
}
