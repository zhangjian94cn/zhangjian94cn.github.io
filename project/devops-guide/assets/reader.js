(()=>{'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const menu=$('#menu-toggle'),shade=$('#nav-shade');
function closeNav(){document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','展开章节目录');shade.hidden=true}
menu.addEventListener('click',()=>{const open=!document.body.classList.contains('nav-open');document.body.classList.toggle('nav-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'关闭章节目录':'展开章节目录');shade.hidden=!open});
shade.addEventListener('click',closeNav);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav()});
window.addEventListener('resize',()=>{if(window.innerWidth>840)closeNav()});
const active=$('.chapter-link.active');if(active){const nav=$('#course-nav');nav.scrollTop=Math.max(0,active.offsetTop-nav.clientHeight/2)}

const dialog=$('#search-dialog'),input=$('#search-input'),results=$('#search-results'),status=$('#search-status');
const data=window.DEVOPS_SEARCH||[];
function search(){const query=input.value.trim().slice(0,120).toLowerCase();results.replaceChildren();if(!query){status.textContent='搜索正文、专题与参考页。Esc 关闭。';return}
 const terms=query.split(/\s+/).filter(Boolean);
 const matches=data.map(p=>({...p,score:terms.reduce((score,term)=>score+(p.title.toLowerCase().includes(term)?12:0)+(p.text.toLowerCase().includes(term)?1:0),0)})).filter(p=>terms.every(t=>(p.title+' '+p.text).toLowerCase().includes(t))).sort((a,b)=>b.score-a.score);const found=matches.slice(0,20);
 status.textContent=found.length?`找到 ${matches.length} 个相关页面${matches.length>20?'，显示前 20 个':''}`:'没有匹配结果。试试更短的关键词，例如“迁移”或“就绪”。';
 for(const p of found){const a=document.createElement('a');a.href=p.slug+'.html';a.className='search-result';const term=terms[0],index=p.text.toLowerCase().indexOf(term),start=Math.max(0,index-45),snippet=p.text.slice(start,start+150);const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=p.chapter?(p.elective?'专题 '+p.chapter:'第 '+p.chapter+' 章'):'参考与资料';const para=document.createElement('p');para.textContent=(start?'…':'')+snippet+'…';a.append(small,document.createElement('br'),strong,para);results.append(a)}
}
function openSearch(){if(!dialog.open){dialog.showModal();input.focus();search()}}
$('#search-open').addEventListener('click',openSearch);$('#search-close').addEventListener('click',()=>dialog.close());
input.addEventListener('input',search);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}});
input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const first=$('a',results);if(first){e.preventDefault();first.focus()}}});
let copyTimer;
function notice(text){const n=$('#copy-notice');n.textContent=text;n.hidden=false;clearTimeout(copyTimer);copyTimer=setTimeout(()=>n.hidden=true,2400)}
$$('.prose pre').forEach(pre=>{const code=$('code',pre);if(!code)return;const lang=(code.className.match(/language-([\w-]+)/)||[])[1]||'text';const label=document.createElement('span');label.className='code-language';label.textContent=lang;const button=document.createElement('button');button.type='button';button.className='copy-button';button.textContent='复制';button.setAttribute('aria-label','复制这段 '+lang+' 代码');button.addEventListener('click',async()=>{try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(code.textContent)}else{const area=document.createElement('textarea');area.value=code.textContent;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('copy unavailable')}notice('代码已复制')}catch{notice('暂时无法自动复制，请选中代码复制')}});pre.append(label,button)});
$$('.print-button').forEach(b=>b.addEventListener('click',()=>window.print()));
const headings=$$('.prose h2[id],.prose h3[id]'),tocLinks=$$('.page-toc a[href^="#section-"]');let scheduled=false;
function updateToc(){scheduled=false;let current=headings[0];for(const h of headings){if(h.getBoundingClientRect().top<135)current=h;else break}for(const a of tocLinks)a.classList.toggle('current',!!current&&a.getAttribute('href')==='#'+current.id)}
window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateToc)}},{passive:true});updateToc();

function buttons(root,options,onSelect,selected=0){const bar=document.createElement('div');bar.className='demo-options';options.forEach((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(i===selected));b.addEventListener('click',()=>{$$('button',bar).forEach((x,j)=>x.setAttribute('aria-pressed',String(i===j)));onSelect(i)});bar.append(b)});root.append(bar)}
$$('[data-widget]').forEach(root=>{root.className='demo';const kind=root.dataset.widget;
 if(kind==='slo'){
  root.innerHTML='<h3>计算请求型错误预算</h3><p>教学计算器：使用相同窗口、同一统计口径的有效请求。不能据此证明生产达标。</p><form class="slo-form"><label>有效请求数<input name="total" type="number" min="1" step="1" value="1000000" required></label><label>坏请求数<input name="bad" type="number" min="0" step="1" value="800" required></label><label>SLO 目标（%）<input name="target" type="number" min="0.001" max="99.99999" step="any" value="99.9" required></label></form><div class="demo-output" role="status" aria-live="polite"></div>';
  const form=$('form',root),out=$('.demo-output',root),fmt=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
  function calculate(){
   const values=['total','bad','target'].map(k=>form.elements.namedItem(k).value);
   const [total,bad,target]=values.map(Number);
   if(values.some(v=>!v.trim())||!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(bad)||bad<0||bad>total||!Number.isFinite(target)||target<=0||target>=100){out.textContent='请输入正整数有效请求数、0 到总数之间的坏请求数，以及大于 0、小于 100 的目标百分比。';return}
   const budget=total*(100-target)/100,remaining=budget-bad,used=bad/budget*100,availability=(total-bad)/total*100;
   out.innerHTML=`<strong>允许坏请求量：${fmt.format(budget)}</strong><br>已用预算 ${fmt.format(used)}%；${remaining>=-1e-8?'剩余':'超出'} ${fmt.format(Math.abs(remaining))} 次。<br>当前样本成功率：${new Intl.NumberFormat('zh-CN',{maximumFractionDigits:5}).format(availability)}%。${remaining< -1e-8?' 已超预算，应按预先约定的策略处理。':''}`;
  }
  form.addEventListener('input',calculate);form.addEventListener('submit',e=>e.preventDefault());calculate();
 }
 if(kind==='request-path'){root.innerHTML='<h3>一次请求，五个检查点</h3><p>概念演示：选择故障发生的位置，观察哪些阶段尚未得到验证。</p>';const stages=['DNS','连接','TLS','HTTP 入口','业务与数据'];const path=document.createElement('div');path.className='demo-path';const out=document.createElement('div');out.className='demo-output';out.setAttribute('role','status');const texts=['请求抵达业务。仍需验证实际结果和运行条件。','域名未能解析。先确认解析器与记录，尚未验证后续连接。','连接未建立。检查地址、端口、监听、路由和过滤规则。','身份验证失败。检查主机名、证书链、有效期与信任根。','入口未得到有效上游响应。对比直接访问应用的结果。','请求抵达应用但业务失败。检查输入、配置、日志和数据库。'];function render(i){const fail=i-1;path.innerHTML=stages.map((s,j)=>`<div class="demo-node ${i===0?'':j===fail?'fail':j>fail?'wait':''}">${esc(s)}<br><small>${i===0||j<fail?'通过':j===fail?'失败':'未验证'}</small></div>`).join('');out.textContent=texts[i]}buttons(root,['全部正常','DNS 失败','连接失败','TLS 失败','入口失败','业务失败'],render);root.append(path,out);render(0)}
 if(kind==='health'){root.innerHTML='<h3>存活与就绪为什么不同？</h3><p>这是状态模型，不会启停你的真实服务。</p>';const out=document.createElement('div');out.className='demo-output';out.setAttribute('role','status');function render(i){out.innerHTML=[`<strong>进程正常 / 数据库正常</strong><br>live → 200；ready → 200。仍要另做业务验证。`,`<strong>进程正常 / 数据库不可用</strong><br>live → 200；ready → 503。进程能响应，但不应接收依赖数据库的业务流量。`,`<strong>进程没有运行</strong><br>无法取得应用的 HTTP 响应。先检查进程、端口与运行环境。`][i]}buttons(root,['全部正常','数据库故障','进程停止'],render);root.append(out);render(0)}
 if(kind==='pipeline'){root.innerHTML='<h3>检查失败之后，哪些阶段应继续？</h3><p>模拟依赖关系。实际门禁由工作流与仓库设置共同执行。</p>';const flow=document.createElement('div');flow.className='demo-path';const out=document.createElement('div');out.className='demo-output';out.setAttribute('role','status');function render(i){const names=['测试','构建','部署','业务验证','清理'];flow.innerHTML=names.map((n,j)=>`<div class="demo-node ${i&&j===0?'fail':i&&j>0&&j<4?'wait':''}">${n}<br><small>${i&&j===0?'失败':i&&j>0&&j<4?'不执行':'执行'}</small></div>`).join('');out.textContent=i?'测试失败，候选版本不能继续发布；清理仍执行，失败证据保留。':'按依赖顺序执行。只有相应检查通过，才进入下一阶段。'}buttons(root,['检查通过','测试失败'],render);root.append(flow,out);render(0)}
 if(kind==='digest'){root.innerHTML='<h3>tag 可以移动，内容标识保持指向同一制品</h3><p>这里的 A / B 是示意制品标识，不是真实镜像摘要。</p>';const out=document.createElement('div');out.className='demo-table';out.setAttribute('role','status');function render(i){out.innerHTML=`<div><strong>引用 ticketdesk:stable</strong><span>现在解析到制品 ${i?'B':'A'}</span></div><div><strong>固定制品 A 的 digest</strong><span>仍解析到制品 A</span></div>`}buttons(root,['stable 指向 A','将 stable 移到 B'],render);root.append(out);render(0)}
});
})();
