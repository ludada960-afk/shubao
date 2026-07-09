const fs = require("fs");
let c = fs.readFileSync("shubao-final.jsx", "utf8");

// Search for the unique part of the regen button handler
const mid = "暂无该图的prompt，无法重新生成";
const midIdx = c.indexOf(mid);
if (midIdx < 0) { console.log("prompt check not found"); process.exit(1); }

// Find the start: go back from midIdx to find 'onClick={'
const beforeMid = c.slice(midIdx - 400, midIdx);
const onClickStart = beforeMid.lastIndexOf("onClick={async(e)=>{");
if (onClickStart < 0) { console.log("onClick start not found"); process.exit(1); }
const si = midIdx - 400 + onClickStart;

// Find the end: 'setRegenLoading(false);e.currentTarget.style.background='
const endTag = 'setRegenLoading(false);e.currentTarget.style.background="rgba(0,0,0,0.5)";';
const ei = c.indexOf(endTag, midIdx) + endTag.length;
if (ei <= endTag.length) { console.log("end not found"); process.exit(1); }

const ov =
"onClick={async(e)=>{" +
"e.stopPropagation();" +
"if(regenLoading)return;" +
"const prompts=result.image_prompts||[];" +
"const p=idx===0?result.cover_prompt:(prompts.find(p=>p.page_id===idx+1)||{}).prompt;" +
'if(!p){alert("暂无该图的prompt，无法重新生成");return;}' +
'if(!confirm("重新生成这张图将消耗一次额度，确定继续吗？"))return;' +
'/* 立即DOM加载遮罩（不等React re-render） */' +
'document.getElementById("rlo")?.remove();' +
"const d=document.createElement('div');d.id='rlo';" +
"d.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .15s';" +
"d.innerHTML='<div style=\"background:#fff;border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp .25s\"><svg viewBox=\"0 0 24 24\" width=\"40\" height=\"40\" fill=\"none\" stroke=\"#FF4757\" stroke-width=\"2.5\" stroke-linecap=\"round\" class=\"spin\"><path d=\"M12 2v4\"/><path d=\"M12 18v4\"/><path d=\"M4.93 4.93l2.83 2.83\"/><path d=\"M16.24 16.24l2.83 2.83\"/><path d=\"M2 12h4\"/><path d=\"M18 12h4\"/><path d=\"M4.93 19.07l2.83-2.83\"/><path d=\"M16.24 7.76l2.83-2.83\"/></svg><div style=\"font-size:17px;font-weight:700;margin-top:16px;color:#333\">\u{1F504} 正在重新生成图片</div><div style=\"font-size:13px;color:#999;margin-top:6px\">请勿刷新或关闭页面，否则会消耗额度</div></div>';" +
'document.body.appendChild(d);' +
'setRegenLoading(true);' +
"e.currentTarget.style.background='rgba(255,71,87,0.8)';" +
'try{' +
'const r=await fetch(API+"/api/regenerate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:p})});' +
'if(!r.ok)throw Error("API错误");' +
'const d2=await r.json();' +
'if(d2.url){' +
'if(idx===0)setResult(prev=>({...prev,cover_url:d2.url}));' +
'else{const arr=[...(result.image_urls||[])];arr[idx-1]=d2.url;setResult(prev=>({...prev,image_urls:arr}));}' +
'}' +
'}catch(err){alert("重新生成失败，请稍后再试");}' +
'document.getElementById("rlo")?.remove();' +
"setRegenLoading(false);e.currentTarget.style.background='rgba(0,0,0,0.5)';";

c = c.slice(0, si) + ov + c.slice(ei);
fs.writeFileSync("shubao-final.jsx", c, "utf8");
console.log("✓ Done - regen now uses DOM overlay (immediate, no React delay)");
