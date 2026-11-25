function stopdepChannel(address = location.href) {
  try {
    const url = new URL(address);
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null;
    const parts = url.pathname.toLowerCase().split('/').filter(Boolean);
    const channel = parts[0] === 'popout' ? parts[1] : parts[0];
    return /^[a-z0-9_]{1,25}$/.test(channel || '') ? channel : null;
  } catch {
    return null;
  }
}
function stopdepProfile(settings) {
  const channel = stopdepChannel();
  return channel ? settings.twitchProfiles?.[channel] || {} : {};
}
