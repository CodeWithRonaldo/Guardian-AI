function ts() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export const log = {
  info:  (...args) => console.log( `[${ts()}] INFO `, ...args),
  warn:  (...args) => console.warn(`[${ts()}] WARN `, ...args),
  error: (...args) => console.error(`[${ts()}] ERROR`, ...args),
};
