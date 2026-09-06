// Test-only baseline: run the same production scheduler with one worker.
const originalWorkers = window.__mutualsCore.runWorkers;
window.__mutualsCore.runWorkers = (items, concurrency, worker, signal) => originalWorkers(items, 1, worker, signal);
