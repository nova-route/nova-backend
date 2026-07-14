/**
 * RouterService: High-level API for route calculations
 * 
 * Provides input validation, BigInt parsing, and error handling
 * Acts as a bridge between Express handlers and the core routing engine
 */

import routerEngine from "./routerEngine.js";

/**
 * Request validation and parsing
 */
export interface RouteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
}

/**
 * Success response structure
 */
export interface RouteSuccessResponse {
  success: true;
  data: {
    bestRoute: string[];
    poolPath: string[];
    expectedAmountOut: string; // BigInt as string for JSON
    priceImpact: number;
    totalFeesApplied: string; // BigInt as string for JSON
  };
}

/**
 * Error response structure
 */
export interface RouteErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export type RouteResponse = RouteSuccessResponse | RouteErrorResponse;

/**
 * Parse and validate route request parameters
 */
export function parseRouteRequest(
  tokenIn: unknown,
  tokenOut: unknown,
  amountIn: unknown
): RouteRequest | RouteErrorResponse {
  // Validate token inputs
  if (typeof tokenIn !== "string" || !tokenIn.trim()) {
    return {
      success: false,
      error: "tokenIn must be a non-empty string",
      statusCode: 400,
    };
  }

  if (typeof tokenOut !== "string" || !tokenOut.trim()) {
    return {
      success: false,
      error: "tokenOut must be a non-empty string",
      statusCode: 400,
    };
  }

  // Validate amount input
  if (amountIn === undefined || amountIn === null) {
    return {
      success: false,
      error: "amountIn is required",
      statusCode: 400,
    };
  }

  let parsedAmount: bigint;

  try {
    // Handle both string and number inputs
    const amountStr =
      typeof amountIn === "string" ? amountIn : String(amountIn);

    // Ensure it's a valid number format
    if (!/^\d+$/.test(amountStr)) {
      throw new Error("Amount must be a positive integer");
    }

    parsedAmount = BigInt(amountStr);

    if (parsedAmount <= BigInt(0)) {
      throw new Error("Amount must be greater than 0");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid amount format";
    return {
      success: false,
      error: message,
      statusCode: 400,
      details: { providedValue: String(amountIn) },
    };
  }

  return {
    tokenIn: tokenIn.trim().toUpperCase(),
    tokenOut: tokenOut.trim().toUpperCase(),
    amountIn: parsedAmount,
  };
}

/**
 * Calculate optimal route and format response
 */
export function calculateRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint
): RouteResponse {
  try {
    // Check for same-token edge case
    if (tokenIn === tokenOut) {
      return {
        success: true,
        data: {
          bestRoute: [tokenIn],
          poolPath: [],
          expectedAmountOut: amountIn.toString(),
          priceImpact: 0,
          totalFeesApplied: "0",
        },
      };
    }

    // Query routing engine
    const result = routerEngine.findOptimalRoute(tokenIn, tokenOut, amountIn);

    if (!result) {
      return {
        success: false,
        error: `No viable route found between ${tokenIn} and ${tokenOut}`,
        statusCode: 404,
        details: {
          fromToken: tokenIn,
          toToken: tokenOut,
          supportedTokens: routerEngine.getSupportedTokens(),
        },
      };
    }

    return {
      success: true,
      data: {
        bestRoute: result.bestRoute,
        poolPath: result.poolPath,
        expectedAmountOut: result.expectedAmountOut.toString(),
        priceImpact: result.priceImpact,
        totalFeesApplied: result.totalFeesApplied.toString(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: "Failed to calculate route",
      statusCode: 500,
      details: { message },
    };
  }
}

/**
 * Get supported tokens
 */
export function getSupportedTokens(): string[] {
  return routerEngine.getSupportedTokens();
}

/**
 * Get pool details
 */
export function getPoolDetails(
  poolId: string
): {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  feeInBasisPoints: number;
} | null {
  return routerEngine.getPoolDetails(poolId);
}