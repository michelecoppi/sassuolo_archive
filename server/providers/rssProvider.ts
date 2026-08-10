import Parser from 'rss-parser';
const parser = new Parser();
const feeds = [
  { source: 'Google News', url: 'https://news.google.com/rss/search?q=Sassuolo%20Calcio&hl=it&gl=IT&ceid=IT:it' }
];

export async function fetchNews() {
  const items:any[]=[]; const errors:string[]=[];
  if(process.env.ENABLE_RSS === 'false') return {items,errors:['RSS disabilitato']};
  for(const feed of feeds){
    try{
      const parsed=await parser.parseURL(feed.url);
      for(const item of parsed.items ?? []) items.push({
        title:item.title ?? 'Senza titolo', url:item.link, source:feed.source,
        publishedAt:item.isoDate ?? item.pubDate ?? null,
        description:item.contentSnippet ?? item.content ?? null,
        imageUrl:(item.enclosure as any)?.url ?? null
      });
    }catch(e){errors.push(`${feed.source}: ${String(e)}`);}
  }
  return {items,errors};
}
