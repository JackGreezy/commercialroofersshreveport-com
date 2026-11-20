import registry from './data/ai-pages.generated.json' with {type:'json'};
import {next} from '@vercel/functions';
import {prefersMarkdown,markdownResponse} from './lib/ai/http.mjs';
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
