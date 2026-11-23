/* oxlint-disable */
// Stub of the head listener (`renderListener`) until `resume-loader` ships the real one.
(() => {
  const boot = (self.$idlip ||= []);
  boot.q ||= [];
  const types = new Set();

  function resolve(item, element, event) {
    if (!Array.isArray(item) || item[0] !== '$event') {
      return item;
    }
    let value = event;
    for (const segment of item.slice(1)) {
      value = segment === 'currentTarget' ? element : value?.[segment];
    }
    return value;
  }

  function handle(event) {
    for (let node = event.target; node instanceof Element; node = node.parentElement) {
      const raw = node.getAttribute(`on:${event.type}`);
      if (raw === null) {
        continue;
      }
      if (raw[0] !== '[') {
        // An event function: the name, then the modifiers.
        const [site, ...mods] = raw.split(' ');
        if (mods.includes('prevent')) {
          event.preventDefault();
        }
        boot.q.push({ site, event, current: node, target: node, type: event.type, latest: false });
        return;
      }
      const [tag, payload, modifier] = JSON.parse(raw);
      if (modifier?.startsWith('key:') && event.key !== modifier.slice(4)) {
        return;
      }
      if (modifier === 'prevent') {
        event.preventDefault();
      }
      const resolved = [];
      for (const item of payload) {
        resolved.push(resolve(item, node, event));
      }
      boot.q.push({
        message: { t: tag, p: resolved },
        target: node,
        type: event.type,
        latest: false,
      });
      return;
    }
  }

  function listen(record) {
    for (const type of record[0].split(' ')) {
      if (!types.has(type)) {
        types.add(type);
        document.addEventListener(type, handle);
      }
    }
  }

  const push = boot.push;
  boot.push = (...records) => {
    for (const record of records) {
      listen(record);
    }
    return push.apply(boot, records);
  };
  for (const record of boot) {
    listen(record);
  }
})();
