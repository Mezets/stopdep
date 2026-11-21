const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../docs');
const base=(process.env.SITE_URL||process.argv[2]||'').replace(/\/?$/,'/');
if(!/^https:\/\/[^/]+/.test(base))throw Error('Provide SITE_URL with the published HTTPS address');
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const title='СтопДЕП — блокировка букмекеров, казино и рекламы';
html=html.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/,'');
const tags=[
'<link rel="canonical" href="'+escape(base)+'">',
'<meta property="og:url" content="'+escape(base)+'">',
'<meta property="og:image" content="'+escape(base+'icon.png')+'">',
'<meta name="twitter:image" content="'+escape(base+'icon.png')+'">',
'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'СтопДЕП',applicationCategory:'BrowserApplication',operatingSystem:'Chrome, Edge',url:base,downloadUrl:base+'StopDEP.zip',description:'Блокировка азартных сайтов, маски рекламы и пользовательские замены текста.'})+'</script>'
].join('\n');
html=html.replace('</head>','<!-- SEO:START -->'+tags+'<!-- SEO:END --></head>');
fs.writeFileSync(path.join(root,'index.html'),html);
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+escape(base)+'</loc></url></urlset>');
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+base+'sitemap.xml\n');
