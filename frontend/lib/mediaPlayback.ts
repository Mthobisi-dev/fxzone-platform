let activeMedia: HTMLMediaElement | null = null;

/** Ensure a newly played attachment stops any other FxZone media attachment. */
export function playExclusive(media: HTMLMediaElement) {
  if (activeMedia && activeMedia !== media) activeMedia.pause();
  activeMedia = media;
}

export function releaseMedia(media: HTMLMediaElement) {
  if (activeMedia === media) activeMedia = null;
}
