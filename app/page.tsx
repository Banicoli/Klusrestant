'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type Scan = { scan_type:string; objects?: any[]; materials?: any[]; transport_size?:string; overall_confidence?:number; uncertainties?:string[] };

type Listing = { id:string; title:string; description:string|null; material:string|null; quantity:number|null; length_mm:number|null; width_mm:number|null; thickness_mm:number|null; price:number|null; created_at:string };

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string|null>(null);
  const [scan, setScan] = useState<Scan|null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [price, setPrice] = useState('20');

  useEffect(() => { loadListings(); }, []);

  async function loadListings() {
    const { data } = await supabase.from('listings').select('id,title,description,material,quantity,length_mm,width_mm,thickness_mm,price,created_at').eq('status','active').order('created_at',{ascending:false}).limit(20);
    if (data) setListings(data as Listing[]);
  }

  function choosePile() { inputRef.current?.click(); }

  async function handleFile(file?: File) {
    if (!file) return;
    setError(''); setScan(null); setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setImage(dataUrl);
      try {
        const res = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({image:dataUrl}) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Analyse mislukt');
        setScan(json);
      } catch (e) { setError(e instanceof Error ? e.message : 'Analyse mislukt'); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  }

  async function publish() {
    if (!scan || !image) return;
    setSaving(true); setError('');
    try {
      let { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        const result = await supabase.auth.signInAnonymously();
        if (result.error) throw new Error('Anonieme login staat nog niet aan in Supabase Auth. Zet Anonymous Sign-Ins aan.');
        auth = result.data;
      }
      const obj = scan.objects?.[0] || {};
      const title = scan.scan_type === 'pile' ? 'Gemengde partij bouwmaterialen' : `${obj.quantity || 1}× ${obj.material || 'bouwmateriaal'}${obj.width_mm && obj.thickness_mm && obj.length_mm ? ` ${obj.width_mm}×${obj.thickness_mm}×${obj.length_mm}` : ''}`;
      const description = scan.scan_type === 'pile' ? `Gemengde restpartij. Voornamelijk ${(scan.materials||[]).map(x=>`${x.material} (${x.percentage}%)`).join(', ')}.` : `Overgebleven bouwmateriaal. Conditie: ${obj.condition || 'gebruikt maar bruikbaar'}.`;
      const { data: listing, error: insertError } = await supabase.from('listings').insert({ user_id:auth.user?.id, title, description, material:obj.material || 'Gemengde bouwmaterialen', material_category:obj.category || 'overig', quantity:obj.quantity || 1, length_mm:obj.length_mm, width_mm:obj.width_mm, thickness_mm:obj.thickness_mm, condition:obj.condition || 'gebruikt', price:Number(price), scan_type:scan.scan_type === 'pile' ? 'pile':'precision', ai_confidence:scan.overall_confidence, ai_raw:scan, status:'active' }).select().single();
      if (insertError) throw insertError;
      const blob = await fetch(image).then(r=>r.blob());
      const path = `${auth.user?.id}/${listing.id}.jpg`;
      const upload = await supabase.storage.from('listing-images').upload(path, blob, {contentType:'image/jpeg',upsert:true});
      if (upload.error) throw upload.error;
      await supabase.from('listing_images').insert({listing_id:listing.id,storage_path:path});
      setImage(null); setScan(null); await loadListings();
    } catch (e) { setError(e instanceof Error ? e.message : 'Plaatsen mislukt'); }
    finally { setSaving(false); }
  }

  return <main className="shell">
    <div className="logo">KLUSRESTANT</div>
    <div className="tag">Van restmateriaal naar bouwmateriaal.</div>

    {!image && <section className="hero"><h1>Gooi het niet weg.</h1><p>Maak één foto. Wij maken er een advertentie van.</p><div className="scanGrid">
      <button className="scan" onClick={()=>inputRef.current?.click()}><span className="icon">📷</span><strong>Scan materiaal</strong><span>Losse stukken en bundels</span></button>
      <button className="scan secondary" onClick={choosePile}><span className="icon">🏔️</span><strong>Scan een berg</strong><span>Gemengde restpartijen</span></button>
    </div></section>}

    <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>handleFile(e.target.files?.[0])}/>

    {image && <section className="panel"><img src={image} className="photo" alt="Gescand restmateriaal"/>{loading && <div className="result"><strong>Even kijken...</strong><p className="muted">Materiaal, aantallen en afmetingen worden geschat.</p></div>}{scan && <div className="result">
      <strong>{scan.scan_type === 'pile' ? 'Partij gevonden' : 'Dit denken we dat je hebt'}</strong>
      {scan.scan_type === 'precision' && scan.objects?.map((o,i)=><div key={i}><h2>{o.quantity || 1}× {o.material}</h2><p>{o.width_mm && o.thickness_mm && o.length_mm ? `${o.width_mm} × ${o.thickness_mm} × ${o.length_mm} mm` : 'Afmetingen niet betrouwbaar te bepalen'}</p><p className="muted">Conditie: {o.condition || 'onbekend'} · zekerheid: {Math.round((o.confidence||0)*100)}%</p></div>)}
      {scan.scan_type === 'pile' && <><h2>Gemengde restpartij</h2><p>{(scan.materials||[]).map(x=>`${x.material} ${x.percentage}%`).join(' · ')}</p><p className="muted">Transport: {scan.transport_size || 'onbekend'}</p></>}
      <div className="field"><label>Vraagprijs</label><input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/></div>
      <button className="primary" onClick={publish} disabled={saving}>{saving ? 'Plaatsen...' : 'Plaats advertentie'}</button><button className="secondaryBtn" onClick={()=>{setImage(null);setScan(null)}}>Opnieuw</button>
    </div>}
    {error && <div className="error">{error}</div>}</section>}

    <section className="feed"><h2>Net geplaatst</h2>{listings.length===0 && <p className="muted">Nog niets. Jij kunt de eerste zijn.</p>}{listings.map(l=><article className="listing" key={l.id}><h3>{l.title}</h3><p>{l.description}</p><div className="price">€ {Number(l.price||0).toFixed(0)}</div></article>)}</section>
  </main>;
}