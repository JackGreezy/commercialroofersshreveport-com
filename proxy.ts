import registry from './data/ai-pages.generated.json' with {type:'json'};
import {next} from '@vercel/functions';
export function prefersMarkdown(accept = '') {
  if (!accept.trim()) return false;
  const ranges = accept.toLowerCase().split(',').map(item => {
    const [type, ...params] = item.trim().split(';');
    const raw = params.find(p => /^\s*q\s*=/.test(p));
    const q = raw ? Number(raw.split('=')[1].trim()) : 1;
    return { type: type.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  function quality(type) {
    for (const pattern of [type, 'text/*', '*/*']) {
      const matches = ranges.filter(r => r.type === pattern);
      if (matches.length) return Math.max(...matches.map(r => r.q));
    }
    return 0;
  }
  // A wildcard alone never opts a client into Markdown.
  return ranges.some(r => r.type === 'text/markdown' && r.q > 0) && quality('text/markdown') > quality('text/html');
}
export function markdownResponse(page, method = 'GET') {
  const body = page?.markdown || '# Not found\n\nNo public Markdown page exists at this address.\n';
  const headers = {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Markdown-Tokens': String(Math.ceil(body.length / 4)),
    'X-Robots-Tag': 'noindex, follow',
    'Vary': 'Accept',
    'Cache-Control': page ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
  };
  if (page) {
    headers['Content-Location'] = page.canonical;
    headers.Link = `<${page.canonical}>; rel="canonical"`;
    if (page.lastModified) headers['Last-Modified'] = new Date(page.lastModified).toUTCString();
  }
  return new Response(method === 'HEAD' || method === 'OPTIONS' ? null : body, { status: method === 'OPTIONS' ? 204 : page ? 200 : 404, headers });
}

export default function middleware(request){
 const url=new URL(request.url),pathname=url.pathname.replace(/\/+$/,'')||'/';
 if(pathname==='/api/md/_catalog')return new Response(request.method==='HEAD'?null:JSON.stringify({site:registry.site,total:Object.keys(registry.pages).length,pages:Object.values(registry.pages).map(({route,canonical,title,summary,markdownUrl,lastModified})=>({route,canonical,title,summary,markdownUrl,lastModified,inFullContent:registry.fullRoutes.includes(route)})),skipped:registry.skipped}),{headers:{'Content-Type':'application/json; charset=utf-8','X-Robots-Tag':'noindex, follow','Access-Control-Allow-Origin':'*','Cache-Control':'public, s-maxage=3600'}});
 let route=pathname,markdown=false;
 if(pathname==='/api/md'||pathname.startsWith('/api/md/')){route=pathname.slice(7)||'/';markdown=true;}
 else if(pathname.endsWith('.md')){route=pathname.slice(0,-3)||'/';markdown=true;}
 if(route==='/index')route='/';
 const page=registry.pages[route];
 if(markdown||(page&&prefersMarkdown(request.headers.get('accept')||''))){if(!['GET','HEAD','OPTIONS'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD, OPTIONS'}});return markdownResponse(page,request.method);}
 const origin=new URL(registry.pages['/'].canonical).origin;
 const discovery=['llms.txt','llms-full.txt','ai.txt'].map(file=>`<${origin}/${file}>; rel="describedby"`).join(', ');
 return page?next({headers:{Link:`<${page.markdownUrl}>; rel="describedby"; type="text/markdown", ${discovery}`,Vary:'Accept'}}):next();
}
