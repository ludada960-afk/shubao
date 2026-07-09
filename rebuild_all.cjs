const fs = require("fs");

// Start with backup
let c = fs.readFileSync("shubao-final.jsx.bak", "utf8");

function check(step) {
  const o = (c.match(/\{/g) || []).length;
  const cl = (c.match(/\}/g) || []).length;
  const ok = o === cl;
  console.log("[" + step + "] " + (ok ? "OK" : "FAIL diff=" + (o - cl)));
  if (!ok) process.exit(1);
}

// 1. Add API constant
c = c.replace("/* ═══════ API ═══════ */", "const API='http://localhost:3099';\n/* ═══════ API ═══════ */");
check(1);

// 2. Replace genAPI
const genStart = c.indexOf('async function genAPI(t){const r=await fetch("https://api.anthropic.com');
const genEnd = c.indexOf("\n", genStart);
const newGen = 'async function genAPI(t){try{const r=await fetch(API+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});if(r.ok)return await r.json();const errText=await r.text().catch(()=>r.statusText);throw new Error(errText.slice(0,200));}catch(e){throw new Error("生成失败："+e.message);}}';
c = c.slice(0, genStart) + newGen + c.slice(genEnd);
check(2);

// 3. Remove PROMPT - find SECOND backtick
const promptIdx = c.indexOf("const PROMPT=");
const firstBT = c.indexOf("`", promptIdx);
const secondBT = c.indexOf("`", firstBT + 1);
c = c.slice(0, promptIdx) + c.slice(secondBT + 1);
check(3);

// 4. saveWork - use server API
const svStart = c.indexOf("async function saveWork(w)");
const svEnd = c.indexOf("function loadWorks", svStart);
c = c.slice(0, svStart) + 'async function saveWork(w){try{await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});}catch(e){console.warn("saveWork error:",e.message);}}' + c.slice(svEnd);
check(4);

// 5. loadWorks - use server API
const ldStart = c.indexOf("async function loadWorks()");
const ldEnd = c.indexOf("function getPts", ldStart);
c = c.slice(0, ldStart) + 'async function loadWorks(){try{const r=await fetch(API+"/api/works");if(r.ok)return await r.json();}catch(e){console.warn("loadWorks error:",e.message);}return[];}' + c.slice(ldEnd);
check(5);

// 6. Remove login requirement from save
const doGenSave = 'if(logged){const np=pts-1;setPtsS(np);await setPts(np);await saveWork({title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages});setWorks(await loadWorks());}';
const newDoGenSave = 'var np=(pts||1)-1;setPtsS(Math.max(0,np));try{await setPts(Math.max(0,np));}catch(e){}await saveWork({title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages,_inputText:text});setWorks(await loadWorks());freeUsed.current=true;';
if (!c.includes(doGenSave)) { console.log("doGen save not found"); process.exit(1); }
c = c.replace(doGenSave, newDoGenSave);
check(6);

// 7. Add textRegen function
const textFn = "\n  const textRegen=async()=>{\n    var inp=result?._inputText||text;\n    if(!inp){alert(\"无法找到原始输入\");return;}\n    if(!confirm(\"重新生成将消耗额度，确定？\"))return;\n    var ov=document.createElement(\"div\");\n    ov.style.cssText=\"position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .15s\";\n    ov.innerHTML='<div style=\"background:#fff;border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp .25s\"><svg viewBox=\"0 0 24 24\" width=\"40\" height=\"40\" fill=\"none\" stroke=\"#FF4757\" stroke-width=\"2.5\" stroke-linecap=\"round\" class=\"spin\"><path d=\"M12 2v4\"/><path d=\"M12 18v4\"/><path d=\"M4.93 4.93l2.83 2.83\"/><path d=\"M16.24 16.24l2.83 2.83\"/><path d=\"M2 12h4\"/><path d=\"M18 12h4\"/><path d=\"M4.93 19.07l2.83-2.83\"/><path d=\"M16.24 7.76l2.83-2.83\"/></svg><div style=\"font-size:17px;font-weight:700;margin-top:16px;color:#333\">✍️ 正在重新生成文章</div><div style=\"font-size:13px;color:#999;margin-top:6px\">请勿刷新或关闭页面，否则会消耗额度</div></div>';\n    document.body.appendChild(ov);\n    try{\n      var r=await fetch(API+\"/api/regenerate-text\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({text:inp})});\n      if(!r.ok)throw Error(\"E\");\n      var d2=await r.json();\n      setResult(p=>({...p,title:d2.title,body_text:d2.body_text,hashtags:d2.hashtags,category:d2.category,_inputText}));\n    }catch(err){alert(\"重新生成失败\");}\n    ov.remove();\n  };";

const catchEnd = '}catch(e){tm.current.forEach(clearTimeout);setErr(e.message);setGen("idle");}};';
if (!c.includes(catchEnd)) { console.log("catch end not found"); process.exit(1); }
c = c.replace(catchEnd, catchEnd + textFn);
check(7);

// 8. Add regen button
const copyBtn = '<Btn primary full onClick={()=>{navigator.clipboard?.writeText(result.title+"\\n\\n"+result.body_text+"\\n\\n"+(result.hashtags||[]).join(" "));}}><Copy size={15}/>一键复制全部文案</Btn>';
const newCopyBtn = '<Btn small onClick={textRegen} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12,padding:"6px 12px"}}><RefreshCw size={12}/> 重新生成文章</Btn>' + copyBtn;
if (!c.includes(copyBtn)) { console.log("copy button not found"); process.exit(1); }
c = c.replace(copyBtn, newCopyBtn);
check(8);

// 9. Replace I object with URL references
const iStart = c.indexOf("const I = {");
let depth = 0, iEnd = -1;
for (let i = iStart; i < c.length; i++) {
  if (c[i] === "{") depth++;
  if (c[i] === "}") { depth--; if (depth === 0) { iEnd = i; break; } }
}
const images = "s1=cropped_13,s2=cropped_14,s3=cropped_15,s4=cropped_16,s5=cropped_17,wave=cropped_8,stand=cropped_9,excited=cropped_10,happy=cropped_11,appicon=cropped,logo=cropped_2,welcome=cropped_12,think=cropped_18,upgrade=cropped_19,loading=cropped_20,result=cropped_21,publish=cropped_22,tip=cropped_23,banner=cropped_24,idea=cropped_25,success=cropped_26,protect=cropped_27,scene=cropped_1,walk=walk,wave-hand=wave-hand,jump=jump,ready=ready,sit=sit,surf=surf,meditate=meditate,cook=cook,dance=dance,done=done,superhero=superhero,curator=curator,inspect=inspect,photographer=photographer,lift=lift".split(",");
const entries = images.map(p => { const [k, v] = p.split("="); return '"' + k + '":"/images/' + v + '.png"' }).join(",");
const newI = "const I = (()=>{const m={};const entries={" + entries + "};for(const[k,v]of Object.entries(entries)){m[k]=new URL(v,import.meta.url).href}return m;})();";
c = c.slice(0, iStart) + newI + c.slice(iEnd + 1);
check(9);

fs.writeFileSync("shubao-final.jsx", c, "utf8");
console.log("\nALL DONE - file size: " + c.length + " bytes");
