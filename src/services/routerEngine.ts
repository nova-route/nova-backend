/**
 * Core graph data structures for AMM liquidity pools and routing
 */

/**
 * Represents a single AMM liquidity pool connecting two tokens
 */
interface AMMPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  feeInBasisPoints: number; // e.g., 30 for 0.30%
}

/**
 * Graph edge representing a directional trading path through a pool
 */
interface GraphEdge {
  poolId: string;
  targetToken: string;
  reserveIn: bigint;
  reserveOut: bigint;
  feeInBasisPoints: number;
}

/**
 * Graph node representing a token with its outgoing edges (trading paths)
 */
interface GraphNode {
  token: string;
  edges: GraphEdge[];
}

/**
 * Represents a complete routing calculation result with all details
 */
interface RouteResult {
  bestRoute: string[]; // Token path [tokenIn, intermediary1, ..., tokenOut]
  poolPath: string[]; // Pool IDs traversed
  expectedAmountOut: bigint;
  priceImpact: number; // As a percentage (e.g., 2.5 for 2.5%)
  totalFeesApplied: bigint;
}

/**
 * RouterService: High-performance liquidity routing engine
 * 
 * Features:
 * - Decoupled graph data structure (tokens as nodes, pools as edges)
 * - Modified Dijkstra pathfinding with 3-hop maximum depth
 * - Constant Product Formula (CPF) calculations: x*y=k
 * - Per-hop fee deduction in basis points
 * - BigInt arithmetic for precision
 * - Price impact calculation
 */
class RouterService {
  private graph: Map<string, GraphNode>;
  private poolRegistry: Map<string, AMMPool>;
  private readonly MAX_HOPS = 3;

  constructor() {
    this.graph = new Map();
    this.poolRegistry = new Map();
    this.initializeLiquidityGraph();
  }

  /**
   * Initialize liquidity graph with sample AMM pools
   * In production, this would load from blockchain or database
   */
  private initializeLiquidityGraph(): void {
    const pools = this.createSamplePools();

    // Register pools and build graph
    for (const pool of pools) {
      this.poolRegistry.set(pool.poolId, pool);
      this.addPoolToGraph(pool);
    }
  }

  /**
   * Create sample AMM pools for demonstration
   */
  private createSamplePools(): AMMPool[] {
    return [
      {
        poolId: "POOL-001",
        tokenA: "XLM",
        tokenB: "USDC",
        reserveA: BigInt("5000000000000000000000000"), // 5M with 18 decimals
        reserveB: BigInt("1000000000000000000000000"), // 1M with 18 decimals
        feeInBasisPoints: 30, // 0.30%
      },
      {
        poolId: "POOL-002",
        tokenA: "USDC",
        tokenB: "USDT",
        reserveA: BigInt("1000000000000000000000000"),
        reserveB: BigInt("1000000000000000000000000"),
        feeInBasisPoints: 5, // 0.05%
      },
      {
        poolId: "POOL-003",
        tokenA: "USDC",
        tokenB: "ETH",
        reserveA: BigInt("2000000000000000000000000"),
        reserveB: BigInt("1000000000000000000000"), // 1k ETH
        feeInBasisPoints: 30,
      },
      {
        poolId: "POOL-004",
        tokenA: "ETH",
        tokenB: "BTC",
        reserveA: BigInt("1000000000000000000000"),
        reserveB: BigInt("50000000000000000000"), // 50 BTC
        feeInBasisPoints: 30,
      },
      {
        poolId: "POOL-005",
        tokenA: "XLM",
        tokenB: "USDT",
        reserveA: BigInt("3000000000000000000000000"),
        reserveB: BigInt("600000000000000000000000"),
        feeInBasisPoints: 30,
      },
    ];
  }

  /**
   * Add a pool to the directed graph (bidirectional)
   */
  private addPoolToGraph(pool: AMMPool): void {
    const { tokenA, tokenB, reserveA, reserveB, feeInBasisPoints, poolId } =
      pool;

    // Initialize nodes if they don't exist
    if (!this.graph.has(tokenA)) {
      this.graph.set(tokenA, { token: tokenA, edges: [] });
    }
    if (!this.graph.has(tokenB)) {
      this.graph.set(tokenB, { token: tokenB, edges: [] });
    }

    // Add edges in both directions (AMM allows bidirectional trading)
    const nodeA = this.graph.get(tokenA)!;
    const nodeB = this.graph.get(tokenB)!;

    nodeA.edges.push({
      poolId,
      targetToken: tokenB,
      reserveIn: reserveA,
      reserveOut: reserveB,
      feeInBasisPoints,
    });

    nodeB.edges.push({
      poolId,
      targetToken: tokenA,
      reserveIn: reserveB,
      reserveOut: reserveA,
      feeInBasisPoints,
    });
  }

  /**
   * Apply Constant Product Formula: x*y=k
   * Output = (inputAfterFee * reserveOut) / (reserveIn + inputAfterFee)
   */
  private calculateCPFOutput(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    feeInBasisPoints: number
  ): bigint {
    // Deduct fee from input
    const feeAmount = (amountIn * BigInt(feeInBasisPoints)) / BigInt(10000);
    const amountInAfterFee = amountIn - feeAmount;

    // Apply CPF formula
    const numerator = amountInAfterFee * reserveOut;
    const denominator = reserveIn + amountInAfterFee;

    if (denominator === BigInt(0)) {
      return BigInt(0);
    }

    return numerator / denominator;
  }

  /**
   * Modified Dijkstra algorithm optimized for AMM routing
   * Maximizes output amount with depth constraint
   */
  private findOptimalPath(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): RouteResult | null {
    // Track best amount to reach each token at each depth level
    const distances: Map<string, bigint> = new Map();
    const predecessors: Map<string, { token: string; poolId: string }> = new Map();
    const visited: Set<string> = new Set();

    distances.set(tokenIn, amountIn);

    // BFS-style traversal with depth tracking
    for (let depth = 0; depth < this.MAX_HOPS; depth++) {
      let bestCurrentToken: string | null = null;
      let bestCurrentAmount: bigint = BigInt(0);

      // Find unvisited token with maximum available amount
      for (const [token, amount] of distances.entries()) {
        if (!visited.has(token) && amount > bestCurrentAmount) {
          bestCurrentToken = token;
          bestCurrentAmount = amount;
        }
      }

      if (bestCurrentToken === null) {
        break;
      }

      visited.add(bestCurrentToken);

      // Early exit if we've reached the target
      if (bestCurrentToken === tokenOut) {
        break;
      }

      // Explore neighbors
      const node = this.graph.get(bestCurrentToken);
      if (!node) continue;

      for (const edge of node.edges) {
        if (visited.has(edge.targetToken)) {
          continue;
        }

        // Calculate output from this hop
        const hopOutput = this.calculateCPFOutput(
          bestCurrentAmount,
          edge.reserveIn,
          edge.reserveOut,
          edge.feeInBasisPoints
        );

        // Update if this is a better path
        if (hopOutput > (distances.get(edge.targetToken) || BigInt(0))) {
          distances.set(edge.targetToken, hopOutput);
          predecessors.set(edge.targetToken, {
            token: bestCurrentToken,
            poolId: edge.poolId,
          });
        }
      }
    }

    // Check if we found a path to the target
    if (!distances.has(tokenOut)) {
      return null;
    }

    const finalAmount = distances.get(tokenOut)!;
    if (finalAmount <= BigInt(0)) {
      return null;
    }

    // Reconstruct path
    const bestRoute: string[] = [];
    const poolPath: string[] = [];
    let current: string | null = tokenOut;

    while (current !== null) {
      bestRoute.unshift(current);

      const pred = predecessors.get(current);
      if (pred) {
        poolPath.unshift(pred.poolId);
        current = pred.token;
      } else {
        current = null;
      }
    }

    // Verify we actually found a valid path
    if (bestRoute[0] !== tokenIn) {
      return null;
    }

    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(amountIn, finalAmount);
    const totalFeesApplied = amountIn - finalAmount;

    return {
      bestRoute,
      poolPath,
      expectedAmountOut: finalAmount,
      priceImpact,
      totalFeesApplied,
    };
  }

  /**
   * Calculate price impact as a percentage
   */
  private calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
    if (amountIn === BigInt(0)) {
      return 0;
    }

    // Assuming 1:1 price baseline (adjustable for real oracle prices)
    const impactPercentage =
      (Number((amountIn - amountOut) * BigInt(10000)) / Number(amountIn)) /
      100;

    return Math.max(0, impactPercentage);
  }

  /**
   * Public API: Find optimal route with validation
   */
  findOptimalRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): RouteResult | null {
    // Validate inputs
    if (!this.graph.has(tokenIn) || !this.graph.has(tokenOut)) {
      return null;
    }

    if (amountIn <= BigInt(0)) {
      return null;
    }

    // Same token optimization
    if (tokenIn === tokenOut) {
      return {
        bestRoute: [tokenIn],
        poolPath: [],
        expectedAmountOut: amountIn,
        priceImpact: 0,
        totalFeesApplied: BigInt(0),
      };
    }

    return this.findOptimalPath(tokenIn, tokenOut, amountIn);
  }

  /**
   * Get list of supported tokens
   */
  getSupportedTokens(): string[] {
    return Array.from(this.graph.keys()).sort();
  }

  /**
   * Get pool details by ID
   */
  getPoolDetails(poolId: string): AMMPool | null {
    return this.poolRegistry.get(poolId) || null;
  }
}

export default new RouterService();
