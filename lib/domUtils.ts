export const waitForElement = (selector: string, timeout = 1000, interval = 50): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, interval);
    };
    check();
  });
};
