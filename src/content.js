// Content script to detect YouTube playlist pages and extract info

(function() {
  function getPlaylistInfo() {
    const url = window.location.href;
    
    const playlistMatch = url.match(/list=([^&]+)/);
    if (!playlistMatch) return null;
    
    const playlistId = playlistMatch[1];
    
    // Get playlist title
    let title = 'Untitled Playlist';
    const titleEl = document.querySelector('h1');
    if (titleEl && titleEl.textContent?.trim()) {
      title = titleEl.textContent.trim();
    }
    
    // Get all playlist videos
    const videos = [];
    
    // Try to get video items
    const videoElements = document.querySelectorAll('ytd-playlist-video-renderer, ytd-grid-video-renderer');
    
    videoElements.forEach((el, index) => {
      // Get video title
      const titleEl = el.querySelector('#video-title, #title-link, a#thumbnail');
      const videoTitle = titleEl?.textContent?.trim() || el.querySelector('a#thumbnail')?.title || `Video ${index + 1}`;
      
      // Get video link
      const linkEl = el.querySelector('a#thumbnail, a.ytd-thumbnail');
      const videoId = linkEl?.href?.match(/v=([^&]+)/)?.[1] || '';
      const videoLink = linkEl?.href || `https://youtube.com/watch?v=${videoId}&list=${playlistId}`;
      
      // Get thumbnail
      const thumbnailEl = el.querySelector('img, yt-img-shadow');
      const thumbnail = thumbnailEl?.src || thumbnailEl?.querySelector('img')?.src || '';
      
      // Get duration
      const durationEl = el.querySelector('#text, .ytd-thumbnail-overlay-time-status-renderer');
      const duration = durationEl?.textContent?.trim() || '';
      
      videos.push({
        id: videoId || `video-${index}`,
        title: videoTitle,
        link: videoLink,
        thumbnail: thumbnail,
        duration: duration,
        index: index
      });
    });
    
    // Get video count from header if available
    let videoCount = videos.length;
    
    const videoCountEl = document.querySelector('#video-count, #video-count span, yt-formatted-string#video-count');
    if (videoCountEl) {
      const text = videoCountEl.textContent || '';
      const match = text.match(/(\d+[\d,]*)/);
      if (match) {
        videoCount = parseInt(match[1].replace(/,/g, ''));
      }
    }
    
    // If we didn't get many videos from DOM, try scrolling to load more
    // The initial batch should be enough for now
    
    return {
      playlistId,
      title,
      videoCount,
      videos,
      url: window.location.href
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPlaylistInfo') {
      const info = getPlaylistInfo();
      sendResponse(info);
    }
    return true;
  });
})();
