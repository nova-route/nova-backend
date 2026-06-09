interface LiquidityEdge {
  target: string;
  liquidity: number;
  feePercentage: number;
}

interface LiquidityNetwork {
  [token: string]: LiquidityEdge[];
}

interface RouteResult {
  path: string[];
  outputAmount: number;
  totalFee: number;
}

class RouterEngine {
  private liquidityNetwork: LiquidityNetwork;
  private readonly POOL_FEE = 0.003; // 0.3% per hop

  constructor() {
    this.liquidityNetwork = this.initializeLiquidityNetwork();
  }

  private initializeLiquidityNetwork(): LiquidityNetwork {
    return {
      XLM: [
        { target: "USDC", liquidity: 5000000, feePercentage: this.POOL_FEE },
        { target: "USDT", liquidity: 3000000, feePercentage: this.POOL_FEE },
        { target: "BTC", liquidity: 500000, feePercentage: this.POOL_FEE },
      ],
      USDC: [
        { target: "XLM", liquidity: 5000000, feePercentage: this.POOL_FEE },
        { target: "USDT", liquidity: 8000000, feePercentage: this.POOL_FEE },
        { target: "ETH", liquidity: 2000000, feePercentage: this.POOL_FEE },
        { target: "BTC", liquidity: 1500000, feePercentage: this.POOL_FEE },
      ],
      USDT: [
        { target: "XLM", liquidity: 3000000, feePercentage: this.POOL_FEE },
        { target: "USDC", liquidity: 8000000, feePercentage: this.POOL_FEE },
        { target: "ETH", liquidity: 1800000, feePercentage: this.POOL_FEE },
      ],
      BTC: [
        { target: "XLM", liquidity: 500000, feePercentage: this.POOL_FEE },
        { target: "USDC", liquidity: 1500000, feePercentage: this.POOL_FEE },
        { target: "ETH", liquidity: 3000000, feePercentage: this.POOL_FEE },
      ],
      ETH: [
        { target: "USDC", liquidity: 2000000, feePercentage: this.POOL_FEE },
        { target: "USDT", liquidity: 1800000, feePercentage: this.POOL_FEE },
        { target: "BTC", liquidity: 3000000, feePercentage: this.POOL_FEE },
      ],
    };
  }

  private calculateOutputAfterFee(amount: number, fee: number): number {
    return amount * (1 - fee);
  }

  private dijkstraPathfinding(
    fromToken: string,
    toToken: string,
    amount: number
  ): RouteResult | null {
    const distances: { [key: string]: number } = {};
    const previous: { [key: string]: string | null } = {};
    const unvisited = new Set<string>();

    // Initialize distances
    for (const token in this.liquidityNetwork) {
      distances[token] = token === fromToken ? amount : 0;
      previous[token] = null;
      unvisited.add(token);
    }

    while (unvisited.size > 0) {
      let currentToken: string | null = null;
      let maxDistance = -Infinity;

      for (const token of unvisited) {
        if (distances[token] > maxDistance) {
          maxDistance = distances[token];
          currentToken = token;
        }
      }

      if (currentToken === null || distances[currentToken] <= 0) {
        break;
      }

      unvisited.delete(currentToken);

      if (currentToken === toToken) {
        break;
      }

      const edges = this.liquidityNetwork[currentToken] || [];
      for (const edge of edges) {
        if (unvisited.has(edge.target)) {
          const outputAfterFee = this.calculateOutputAfterFee(
            distances[currentToken],
            edge.feePercentage
          );

          if (outputAfterFee > distances[edge.target]) {
            distances[edge.target] = outputAfterFee;
            previous[edge.target] = currentToken;
          }
        }
      }
    }

    if (distances[toToken] <= 0) {
      return null;
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = toToken;

    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    if (path[0] !== fromToken) {
      return null;
    }

    const totalFee = amount - distances[toToken];

    return {
      path,
      outputAmount: distances[toToken],
      totalFee,
    };
  }

  findOptimalRoute(
    fromToken: string,
    toToken: string,
    amount: number
  ): RouteResult | null {
    if (!this.liquidityNetwork[fromToken]) {
      return null;
    }

    if (!this.liquidityNetwork[toToken]) {
      return null;
    }

    if (fromToken === toToken) {
      return {
        path: [fromToken],
        outputAmount: amount,
        totalFee: 0,
      };
    }

    if (amount <= 0) {
      return null;
    }

    return this.dijkstraPathfinding(fromToken, toToken, amount);
  }
}

export default new RouterEngine();
