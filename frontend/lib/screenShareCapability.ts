export type ShareCapability = 'supported' | 'unsupported' | 'restricted';

export type NavigatorLike = {
  userAgent?: string;
  maxTouchPoints?: number;
  mediaDevices?: { getDisplayMedia?: unknown };
};

export function getScreenShareCapability(navigatorLike: NavigatorLike | null | undefined): ShareCapability {
  if (typeof navigatorLike?.mediaDevices?.getDisplayMedia !== 'function') return 'unsupported';
  const userAgent = String(navigatorLike.userAgent || '').toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  return isIos ? 'restricted' : 'supported';
}

export function screenShareUnavailableMessage(capability: ShareCapability): string {
  if (capability === 'restricted') return 'Screen sharing is restricted by this mobile browser. Open the session in a supported desktop or Android browser to present.';
  return 'This browser cannot share a device screen. Keep watching here or open the session in a browser with native screen capture support.';
}
