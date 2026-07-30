// Assets are served by the capture-time static server from /assets/.
export const mediaUrl = (p: string) => `/assets/${p.replace(/^\/+/, '').replace(/^vault\//, '')}`;
