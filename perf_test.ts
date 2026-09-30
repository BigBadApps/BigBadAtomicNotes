async function simulateWrite(delayMs: number = 10) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function testSequential() {
  const start = performance.now();
  let count = 0;
  for (let i = 0; i < 100; i++) {
    await simulateWrite();
    count++;
  }
  const end = performance.now();
  console.log(`Sequential: ${end - start}ms, count: ${count}`);
}

async function testConcurrent() {
  const start = performance.now();
  let count = 0;
  await Promise.all(
    Array.from({ length: 100 }).map(async () => {
      await simulateWrite();
      count++;
    })
  );
  const end = performance.now();
  console.log(`Concurrent: ${end - start}ms, count: ${count}`);
}

async function run() {
  await testSequential();
  await testConcurrent();
}

run();
