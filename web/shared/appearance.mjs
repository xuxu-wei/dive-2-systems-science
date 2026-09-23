// boot.js restores the preference synchronously; CSS interpolates the shared colors.
// Keep the live DOM interactive: a browser snapshot transition can swallow quick clicks.
const controller = () => {
  const api = globalThis.window?.systemsScienceAppearance;
  if (!api) throw new Error('主题未初始化，请刷新页面。');
  return api;
};
export const getTheme = () => controller().getTheme();
export function applyTheme(theme, options) {
  if (theme !== 'dark' && theme !== 'light') throw new TypeError('Theme must be dark or light.');
  return controller().applyTheme(theme, options);
}
export const toggleTheme = () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
