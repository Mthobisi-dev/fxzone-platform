/** Read the attachment lines written by existing composers without hiding normal links. */
export function readPostAttachments(content: string, primary?: string) {
  const urls: string[] = primary ? [primary] : [];
  const text = content.split('\n').filter(line => {
    const match = /^📎 (https?:\/\/\S+)\s*$/.exec(line);
    if (!match) return true;
    try {
      const url = new URL(match[1]);
      if (!/\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv|mp3|wav|ogg|pdf)$/i.test(url.pathname)) return true;
      if (!urls.includes(url.href)) urls.push(url.href);
      return false;
    } catch { return true; }
  }).join('\n').trim();
  return { urls, text: text === '📊 Shared media attachment' ? '' : text };
}
