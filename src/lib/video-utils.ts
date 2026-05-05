export interface ResourceInfo {
  type: 'youtube' | 'facebook' | 'affiliate' | 'standard' | 'data';
  embedUrl?: string;
  isAffiliate?: boolean;
  platform?: string;
}

export function analyzeUrl(url: string): ResourceInfo | null {
  if (!url) return null;

  if (url.startsWith('data:image')) {
    return { type: 'data' };
  }

  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      platform: 'YouTube'
    };
  }

  // Facebook
  const fbRegex = /(?:https?:\/\/)?(?:www\.|web\.|m\.)?facebook\.com\/(?:watch\/\?v=|video\.php\?v=|v\/|.+?\/videos\/|.+?\/posts\/|groups\/.+?\/permalink\/|.+?\/videos\/vb\.\d+\/|watch\/\?.+?&v=)(\d+)/;
  const fbMatch = url.match(fbRegex);
  if (fbMatch && fbMatch[1]) {
    return {
      type: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`,
      platform: 'Facebook'
    };
  }

  // Affiliate / Known Stores
  if (url.includes('rokomari.com')) {
    return { type: 'affiliate', isAffiliate: true, platform: 'Rokomari' };
  }
  if (url.includes('amazon.com') || url.includes('amzn.to')) {
    return { type: 'affiliate', isAffiliate: true, platform: 'Amazon' };
  }

  return { type: 'standard' };
}

export function parseVideoUrl(url: string): ResourceInfo | null {
  const info = analyzeUrl(url);
  if (info?.type === 'youtube' || info?.type === 'facebook') return info;
  return null;
}
