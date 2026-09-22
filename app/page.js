"use client";
import {useEffect, useState} from "react";

export default function Home() {
  const [url,setUrl]=useState("");
  const [count,setCount]=useState(3);
  const [duration,setDuration]=useState(45);
  const [job,setJob]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function createJob(e){
    e.preventDefault();
    setLoading(true);
    setError("");
    const r=await fetch("/api/jobs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url,clipCount:count,duration})});
    const data=await r.json();
    if(!r.ok){ setError(data.error || "Could not start the job."); setLoading(false); return; }
    setJob(data); setLoading(false);
  }

  useEffect(()=>{
    if(!job?.id) return;
    const t=setInterval(async()=>{
      const r=await fetch("/api/jobs/"+job.id);
      if(r.ok){ const d=await r.json(); setJob(d); if(["complete","failed"].includes(d.status)) clearInterval(t); }
    },2000);
    return ()=>clearInterval(t);
  },[job?.id]);

  return <main>
    <section className="hero">
      <div className="badge">AI SHORT CLIPPER</div>
      <h1>Turn long videos into<br/><span>scroll-stopping shorts.</span></h1>
      <p>Paste a direct video URL. ClipForge creates vertical short-form excerpts and prepares them for download.</p>
      <form onSubmit={createJob} className="card form">
        <label>Video URL</label>
        <input required value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/video.mp4"/>
        <div className="grid">
          <div><label>Number of clips</label><select value={count} onChange={e=>setCount(+e.target.value)}><option>1</option><option>3</option><option>5</option><option>10</option></select></div>
          <div><label>Target length</label><select value={duration} onChange={e=>setDuration(+e.target.value)}><option value="15">15 sec</option><option value="30">30 sec</option><option value="45">45 sec</option><option value="60">60 sec</option><option value="90">90 sec</option></select></div>
        </div>
        <button disabled={loading}>{loading?"Starting…":"Create my shorts"}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      {job && <section className="card result">
        <div className="row"><strong>Job {job.id.slice(0,8)}</strong><span className={"status "+job.status}>{job.status}</span></div>
        <div className="bar"><i style={{width:`${job.progress||0}%`}}/></div>
        <p>{job.status==="complete" ? "Your clips are ready." : job.status==="failed" ? (job.error||"The job failed.") : `Processing… ${job.progress||0}%`}</p>
        {job.clips?.length>0 && <div className="clips">{job.clips.map(c=><article key={c.id}><div className="thumb">9:16</div><h3>{c.title}</h3><p>{Math.round(c.end-c.start)} sec · score {c.score?.toFixed?.(2) ?? "—"}</p>{c.videoUrl&&<a href={c.videoUrl} download>Download clip</a>}</article>)}</div>}
      </section>}
    </section>
  </main>
}
