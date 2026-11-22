// The growth chart: the bars grow when the chart scrolls into view. Without this script, or with
// reduced motion, the bars show their end state.

const chart = document.querySelector('.grow-chart');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (chart && !reduced && 'IntersectionObserver' in window) {
  // Armed bars are at zero width. The chart is below the first screen, so no one sees the reset.
  chart.classList.add('is-armed');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          chart.classList.add('is-in');
          observer.disconnect();
        }
      }
    },
    { threshold: 0.25 },
  );
  observer.observe(chart);
}

// A module, so its declarations stay local to it.
export {};
