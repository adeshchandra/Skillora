export interface VideoEmbedInfo {
  type: 'youtube' | 'facebook' | 'other';
  embedUrl: string;
}

export function parseVideoUrl(url: string): VideoEmbedInfo | null {
  if (!url) return null;

  // YouTube
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`
    };
  }

  // Facebook
  const fbRegex = /(?:https?:\/\/)?(?:www\.|web\.|m\.)?facebook\.com\/(?:watch\/\?v=|video\.php\?v=|v\/|.+?\/videos\/|.+?\/posts\/|groups\/.+?\/permalink\/|.+?\/videos\/vb\.\d+\/|watch\/\?.+?&v=)(\d+)/;
  const fbMatch = url.match(fbRegex);
  if (fbMatch && fbMatch[1]) {
    return {
      type: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`
    };
  }

  return null;
}
