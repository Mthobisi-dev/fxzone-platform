/** Maximum duration for one uploaded social-post video. */
export const MAX_POST_VIDEO_DURATION_SECONDS = 90;

/**
 * Browser metadata can be missing or infinite for an incomplete upload. Do not
 * submit a post until the duration is known and within the product limit.
 */
export function isAllowedPostVideoDuration(duration: number): boolean {
  return Number.isFinite(duration)
    && duration > 0
    && duration <= MAX_POST_VIDEO_DURATION_SECONDS;
}

/** Read local video metadata without uploading the file. */
export function readLocalVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This video could not be read. Choose a valid MP4, WebM, MOV, or MKV file.'));
    };
    video.src = url;
  });
}
