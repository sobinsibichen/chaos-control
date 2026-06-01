type SyncTask = {
  id: string;
  run: () => Promise<unknown>;
  retries: number;
};

const queue: SyncTask[] = [];
let running = false;

function nextDelay(retries: number) {
  return Math.min(10_000, 400 * 2 ** retries);
}

async function drain() {
  if (running) {
    return;
  }

  running = true;
  while (queue.length) {
    const task = queue[0];
    try {
      await task.run();
      queue.shift();
    } catch (error) {
      task.retries += 1;
      if (task.retries > 4) {
        console.warn("[background-sync] dropping failed task", task.id, error);
        queue.shift();
        continue;
      }

      await new Promise((resolve) => window.setTimeout(resolve, nextDelay(task.retries)));
    }
  }
  running = false;
}

export function enqueueBackgroundSync(id: string, run: () => Promise<unknown>) {
  queue.push({ id, run, retries: 0 });
  void drain();
}
