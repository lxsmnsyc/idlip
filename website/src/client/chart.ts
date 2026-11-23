// The growth chart: the bars grow when the chart scrolls into view. The stylesheet holds the bars
// at zero width under the `js` class of `<html>` until this script adds `is-in` to the chart.
// Without the script, or with reduced motion, the bars show their end state.

const chart = document.querySelector('.grow-chart');

if (chart) {
  if ('IntersectionObserver' in window) {
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
  } else {
    chart.classList.add('is-in');
  }
}

// A module, so its declarations stay local to it.
export {};
