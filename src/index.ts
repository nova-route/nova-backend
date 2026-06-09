import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import routerEngine from "./services/routerEngine.js";

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

// Main routing endpoint
app.get(
  "/api/swap-route",
  (req: Request, res: Response): void => {
    const { fromToken, toToken, amount } = req.query;

    // Validate inputs
    if (!fromToken || !toToken || !amount) {
      res.status(400).json({
        error: "Missing required parameters",
        required: ["fromToken", "toToken", "amount"],
      });
      return;
    }

    const parsedAmount = parseFloat(amount as string);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({
        error: "Amount must be a positive number",
      });
      return;
    }

    const route = routerEngine.findOptimalRoute(
      (fromToken as string).toUpperCase(),
      (toToken as string).toUpperCase(),
      parsedAmount
    );

    if (!route) {
      res.status(404).json({
        error: "No viable route found",
        fromToken: (fromToken as string).toUpperCase(),
        toToken: (toToken as string).toUpperCase(),
      });
      return;
    }

    const mockGasFee = "0.00001 XLM";

    res.json({
      path: route.path,
      inputAmount: parsedAmount,
      expectedOutput: Math.round(route.outputAmount * 1e8) / 1e8, // Round to 8 decimals
      totalFeeAmount: Math.round(route.totalFee * 1e8) / 1e8,
      feePercentage: ((route.totalFee / parsedAmount) * 100).toFixed(3) + "%",
      estimatedGas: mockGasFee,
      hops: route.path.length - 1,
    });
  }
);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response) => {
  console.error("Error:", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "GET /api/swap-route?fromToken=XLM&toToken=USDC&amount=100",
    ],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 NovaRoute Backend running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(
    `📊 Example route query: http://localhost:${PORT}/api/swap-route?fromToken=XLM&toToken=USDC&amount=100`
  );
});
