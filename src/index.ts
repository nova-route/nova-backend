import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  parseRouteRequest,
  calculateRoute,
  getSupportedTokens,
  getPoolDetails,
} from "./services/routerService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "NovaRoute Backend" });
});

/**
 * GET /api/route
 * 
 * Calculates optimal swap route using modified Dijkstra pathfinding
 * with Constant Product Formula (CPF) and per-hop fee deduction
 * 
 * Query Parameters:
 *   - tokenIn: Source token symbol (e.g., "XLM")
 *   - tokenOut: Target token symbol (e.g., "USDC")
 *   - amountIn: Amount to swap in smallest unit (BigInt precision)
 * 
 * Response:
 *   - 200: Route found with details
 *   - 400: Invalid parameters
 *   - 404: No route exists between tokens
 *   - 500: Server error
 */
app.get("/api/route", (req: Request, res: Response): void => {
  const { tokenIn, tokenOut, amountIn } = req.query;

  // Parse and validate inputs
  const parseResult = parseRouteRequest(tokenIn, tokenOut, amountIn);

  if ("success" in parseResult && !parseResult.success) {
    res.status(parseResult.statusCode).json(parseResult);
    return;
  }

  // Type guard: parseResult is now RouteRequest
  if (!("tokenIn" in parseResult)) {
    res.status(400).json({ error: "Invalid parse result" });
    return;
  }

  // Calculate route
  const routeResponse = calculateRoute(
    parseResult.tokenIn,
    parseResult.tokenOut,
    parseResult.amountIn
  );

  if (!routeResponse.success) {
    res.status(routeResponse.statusCode).json(routeResponse);
    return;
  }

  res.status(200).json(routeResponse);
});

/**
 * GET /api/tokens
 * 
 * List all supported tokens
 */
app.get("/api/tokens", (_req: Request, res: Response) => {
  const tokens = getSupportedTokens();
  res.json({
    success: true,
    data: {
      tokens,
      count: tokens.length,
    },
  });
});

/**
 * GET /api/pool/:poolId
 * 
 * Get details of a specific pool
 */
app.get("/api/pool/:poolId", (req: Request, res: Response) => {
  const { poolId } = req.params;
  const pool = getPoolDetails(poolId);

  if (!pool) {
    res.status(404).json({
      success: false,
      error: "Pool not found",
      poolId,
    });
    return;
  }

  res.json({
    success: true,
    data: {
      poolId: pool.poolId,
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      reserveA: pool.reserveA.toString(),
      reserveB: pool.reserveB.toString(),
      feeInBasisPoints: pool.feeInBasisPoints,
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response) => {
  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "GET /api/route?tokenIn=XLM&tokenOut=USDC&amountIn=1000000000000000000",
      "GET /api/tokens",
      "GET /api/pool/:poolId",
    ],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NovaRoute Backend running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Routing endpoint: http://localhost:${PORT}/api/route`);
  console.log(
    `📋 Example: http://localhost:${PORT}/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=1000000000000000000`
  );
});
