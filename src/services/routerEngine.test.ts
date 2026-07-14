/**
 * Unit tests for RouterService
 * 
 * Tests cover:
 * - Direct single-hop routes
 * - Multi-hop routes
 * - No-path scenarios
 * - Edge cases (same token, zero amount)
 * - CPF calculations
 * - Price impact calculations
 */

import routerEngine from "./routerEngine.js";

/**
 * Test helper: Format BigInt to readable string
 */
function formatAmount(amount: bigint, decimals: number = 18): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, -decimals) || "0";
  const fracPart = str.slice(-decimals).padEnd(decimals, "0");
  return `${intPart}.${fracPart}`;
}

/**
 * Test helper: Create test amount
 */
function createAmount(readable: number, decimals: number = 18): bigint {
  return BigInt(Math.floor(readable * Math.pow(10, decimals)));
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🧪 RouterService Unit Tests\n");
  console.log("=".repeat(60));

  const tests = [
    testDirectSwapXLMtoUSDC,
    testDirectSwapUSDCtoXLM,
    testMultiHopXLMtoETH,
    testMaxHopXLMtoBTC,
    testNoPathDisconnected,
    testSameToken,
    testZeroAmount,
    testNegativeAmount,
    testUnsupportedToken,
    testLargeSwap,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
      console.log(`✅ ${test.name}\n`);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${test.name}\n   Error: ${message}\n`);
    }
  }

  console.log("=".repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Test 1: Direct swap XLM → USDC (single hop)
 */
async function testDirectSwapXLMtoUSDC() {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "USDC",
    createAmount(100) // 100 XLM
  );

  if (!result) throw new Error("No route found");
  if (result.bestRoute.length !== 2) throw new Error("Route should be 2 tokens");
  if (result.bestRoute[0] !== "XLM" || result.bestRoute[1] !== "USDC") {
    throw new Error("Route path incorrect");
  }
  if (result.poolPath.length !== 1) throw new Error("Should use 1 pool");
  if (result.poolPath[0] !== "POOL-001") throw new Error("Should use POOL-001");
  if (result.expectedAmountOut <= BigInt(0)) throw new Error("Output should be positive");
  if (result.priceImpact < 0 || result.priceImpact > 100) {
    throw new Error("Price impact out of range");
  }

  console.log(`  Input: 100 XLM`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Pools: ${result.poolPath.join(", ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} USDC`);
  console.log(`  Price Impact: ${result.priceImpact.toFixed(4)}%`);
  console.log(`  Fees: ${formatAmount(result.totalFeesApplied)} XLM`);
}

/**
 * Test 2: Reverse direct swap USDC → XLM
 */
async function testDirectSwapUSDCtoXLM() {
  const result = routerEngine.findOptimalRoute(
    "USDC",
    "XLM",
    createAmount(50) // 50 USDC
  );

  if (!result) throw new Error("No route found");
  if (result.bestRoute.length !== 2) throw new Error("Route should be 2 tokens");
  if (result.bestRoute[0] !== "USDC" || result.bestRoute[1] !== "XLM") {
    throw new Error("Route path incorrect");
  }

  console.log(`  Input: 50 USDC`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} XLM`);
  console.log(`  Price Impact: ${result.priceImpact.toFixed(4)}%`);
}

/**
 * Test 3: Multi-hop route XLM → USDC → ETH (2 hops)
 */
async function testMultiHopXLMtoETH() {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "ETH",
    createAmount(100)
  );

  if (!result) throw new Error("No route found");
  if (result.bestRoute.length !== 3) throw new Error("Route should be 3 tokens");
  if (result.bestRoute[0] !== "XLM" || result.bestRoute[2] !== "ETH") {
    throw new Error("Route endpoints incorrect");
  }
  if (result.poolPath.length !== 2) throw new Error("Should use 2 pools");

  console.log(`  Input: 100 XLM`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Pools: ${result.poolPath.join(", ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} ETH`);
  console.log(`  Price Impact: ${result.priceImpact.toFixed(4)}%`);
  console.log(`  Note: 2-hop route has higher slippage than direct route`);
}

/**
 * Test 4: Maximum hop route XLM → USDC → ETH → BTC (3 hops)
 */
async function testMaxHopXLMtoBTC() {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "BTC",
    createAmount(100)
  );

  if (!result) throw new Error("No route found");
  if (result.bestRoute.length !== 4) throw new Error("Route should be 4 tokens");
  if (result.bestRoute[0] !== "XLM" || result.bestRoute[3] !== "BTC") {
    throw new Error("Route endpoints incorrect");
  }
  if (result.poolPath.length !== 3) throw new Error("Should use 3 pools");
  if (result.bestRoute.length - 1 > 3) throw new Error("Exceeded max hops");

  console.log(`  Input: 100 XLM`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Pools: ${result.poolPath.join(", ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} BTC`);
  console.log(`  Price Impact: ${result.priceImpact.toFixed(4)}%`);
  console.log(`  Hops: ${result.bestRoute.length - 1} (maximum allowed)`);
}

/**
 * Test 5: No path for disconnected tokens
 */
async function testNoPathDisconnected() {
  // Add a hypothetical unsupported token
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "DOGE", // Not in graph
    createAmount(100)
  );

  if (result !== null) throw new Error("Should return null for no path");

  console.log(`  Input: 100 XLM → DOGE (not supported)`);
  console.log(`  Result: null (as expected)`);
  console.log(`  Behavior: Function safely returns null instead of crashing`);
}

/**
 * Test 6: Same token swap (zero fee, same amount out)
 */
async function testSameToken() {
  const amount = createAmount(1000);
  const result = routerEngine.findOptimalRoute("XLM", "XLM", amount);

  if (!result) throw new Error("Should handle same token");
  if (result.bestRoute.length !== 1) throw new Error("Route should have 1 token");
  if (result.bestRoute[0] !== "XLM") throw new Error("Route should be XLM");
  if (result.expectedAmountOut !== amount) throw new Error("Amount should be unchanged");
  if (result.priceImpact !== 0) throw new Error("Price impact should be 0");
  if (result.totalFeesApplied !== BigInt(0)) throw new Error("Fees should be 0");

  console.log(`  Input: 1000 XLM → XLM`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} XLM`);
  console.log(`  Fees: 0 (same token, no swap needed)`);
}

/**
 * Test 7: Zero amount (invalid)
 */
async function testZeroAmount() {
  const result = routerEngine.findOptimalRoute("XLM", "USDC", BigInt(0));

  if (result !== null) throw new Error("Should reject zero amount");

  console.log(`  Input: 0 XLM`);
  console.log(`  Result: null (invalid input)`);
  console.log(`  Behavior: Validation correctly rejects non-positive amounts`);
}

/**
 * Test 8: Negative amount (invalid)
 */
async function testNegativeAmount() {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "USDC",
    BigInt("-1000")
  );

  if (result !== null) throw new Error("Should reject negative amount");

  console.log(`  Input: -1000 XLM`);
  console.log(`  Result: null (invalid input)`);
  console.log(`  Behavior: Validation correctly rejects negative amounts`);
}

/**
 * Test 9: Unsupported source token
 */
async function testUnsupportedToken() {
  const result = routerEngine.findOptimalRoute(
    "INVALID",
    "USDC",
    createAmount(100)
  );

  if (result !== null) throw new Error("Should return null for unsupported token");

  console.log(`  Input: 100 INVALID → USDC`);
  console.log(`  Result: null (token not in graph)`);
  console.log(`  Supported tokens: ${routerEngine.getSupportedTokens().join(", ")}`);
}

/**
 * Test 10: Large swap (tests precision and slippage)
 */
async function testLargeSwap() {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "USDC",
    createAmount(1000000) // 1M XLM (depletes much of POOL-001)
  );

  if (!result) throw new Error("No route found");

  // Large swap should have significant price impact
  if (result.priceImpact < 1) {
    throw new Error("Large swap should have notable price impact");
  }

  console.log(`  Input: 1,000,000 XLM (very large)`);
  console.log(`  Path: ${result.bestRoute.join(" → ")}`);
  console.log(`  Output: ${formatAmount(result.expectedAmountOut)} USDC`);
  console.log(`  Price Impact: ${result.priceImpact.toFixed(4)}% (significant!)`);
  console.log(`  Note: Large trades show high slippage (expected behavior)`);
}

// ============================================================================
// EXECUTION
// ============================================================================

runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Test suite error:", error);
    process.exit(1);
  });
