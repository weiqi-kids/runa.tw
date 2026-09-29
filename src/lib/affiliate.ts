// 購買連結的聯盟轉換。
//
// iChannels（通路王）用 Deep Link（新中央轉址）：固定格式組網址，不需要 API 金鑰。
//   https://product.mchannles.com/redirect_wa.php?k=<K值>&tourl=<URL encode 後的品牌網址>
// K 值取自會員後台「推廣工具 → 網址自動轉換器」產生的程式碼（oeya_member），會出現在每一條推廣連結裡，不是機密。
// 網域 mchannles 是 iChannels 官方文件上的拼法，不是打錯。
// 只對已核准的品牌有效；品牌在 content/brands/*.md 設 affiliate 才會轉換。
import type { CollectionEntry } from 'astro:content';

const ICHANNELS_K = '3TdiB';

export interface Outbound { href: string; affiliate: boolean; rel: string }

export function outbound(url: string, brand: CollectionEntry<'brands'>): Outbound {
  if (brand.data.affiliate?.network === 'ichannels') {
    return {
      href: `https://product.mchannles.com/redirect_wa.php?k=${ICHANNELS_K}&tourl=${encodeURIComponent(url)}`,
      affiliate: true,
      rel: 'sponsored noopener',
    };
  }
  return { href: url, affiliate: false, rel: 'nofollow noopener' };
}
