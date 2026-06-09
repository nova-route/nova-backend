# NovaRoute Pathfinding Engine (Backend)

A high-performance Node.js/TypeScript Express server implementing advanced graph-based pathfinding algorithms to compute optimal multi-hop token trade routes across decentralized finance (DeFi) liquidity pools on the Stellar network.

## Overview

The NovaRoute backend is built on modern web technologies and provides a robust REST API for discovering the most efficient token swap paths. It implements Dijkstra's shortest-path algorithm to analyze a simulated liquidity network graph and determine the route that maximizes output amount while accounting for pool fees.

### Core Features

- **Dijkstra's Pathfinding Algorithm** - Computes optimal routes by maximizing output value after fees
- **Multi-hop Routing** - Supports arbitrary-length swap paths through multiple DEX pools
- **Pool Fee Simulation** - Applies realistic 0.3% per-hop fee to model real-world trading dynamics
- **Type-Safe Implementation** - Full TypeScript type coverage for production reliability
- **RESTful API** - Clean, standardized JSON endpoints for seamless integration
- **Error Handling** - Comprehensive validation and meaningful error responses

## Architecture

### Directory Structure

```
nova-backend/
├── src/
│   ├── index.ts                 # Express server and API endpoints
│   └── services/
│       └── routerEngine.ts      # Dijkstra pathfinding implementation
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── .env.example                 # Environment variable template
└── README.md                    # This file
```

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.3.3+ |
| Framework | Express.js | 4.18.2+ |
| Development | tsx | 4.7.0+ |

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone https://github.com/nova-route/nova-backend.git
cd nova-backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

The `.env` file contains:

```env
PORT=5001
```

You can modify the `PORT` variable to run the server on a different port if needed.

### Running the Server

**Development Mode** (with hot reload):

```bash
npm run dev
```

**Production Build**:

```bash
npm run build
npm start
```

The server will start on `http://localhost:5001` (or your configured PORT).

### Health Check

Verify the server is running:

```bash
curl http://localhost:5001/health
```

Response:

```json
{
  "status": "ok",
  "service": "NovaRoute Backend"
}
```

## API Specification

### Endpoint: GET /api/swap-route

Computes the optimal multi-hop token swap route between two tokens.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromToken` | string | Yes | Source token ticker (e.g., XLM, USDC, USDT, BTC, ETH) |
| `toToken` | string | Yes | Destination token ticker |
| `amount` | number | Yes | Input amount to swap (must be > 0) |

#### Request Example

```bash
curl "http://localhost:5001/api/swap-route?fromToken=XLM&toToken=USDC&amount=100"
```

#### Success Response (200 OK)

```json
{
  "path": ["XLM", "USDC"],
  "inputAmount": 100,
  "expectedOutput": 99.7,
  "totalFeeAmount": 0.3,
  "feePercentage": "0.30%",
  "estimatedGas": "0.00001 XLM",
  "hops": 1
}
```

#### Multi-hop Example Response

```json
{
  "path": ["XLM", "USDT", "USDC"],
  "inputAmount": 1000,
  "expectedOutput": 991.8,
  "totalFeeAmount": 8.2,
  "feePercentage": "0.82%",
  "estimatedGas": "0.00001 XLM",
  "hops": 2
}
```

#### Error Response (400 Bad Request)

Missing or invalid parameters:

```json
{
  "error": "Missing required parameters",
  "required": ["fromToken", "toToken", "amount"]
}
```

Invalid amount:

```json
{
  "error": "Amount must be a positive number"
}
```

#### Error Response (404 Not Found)

No viable route exists:

```json
{
  "error": "No viable route found",
  "fromToken": "XLM",
  "toToken": "UNKNOWN"
}
```

### Response Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `path` | string[] | Array of token symbols representing the swap route |
| `inputAmount` | number | Original input amount requested |
| `expectedOutput` | number | Calculated output amount after all fees |
| `totalFeeAmount` | number | Total fees deducted across all hops |
| `feePercentage` | string | Fee as percentage of input |
| `estimatedGas` | string | Mock gas fee estimate for Stellar network |
| `hops` | number | Number of intermediary swaps in the route |

## Pathfinding Algorithm Details

### Dijkstra's Implementation

The router engine uses Dijkstra's algorithm to find the path that maximizes output value:

1. **Graph Initialization** - Builds a liquidity network with 5 tokens (XLM, USDC, USDT, BTC, ETH) and interconnected pools
2. **Distance Tracking** - Maintains running output amounts as paths are explored
3. **Hop Processing** - Simulates 0.3% fee deduction at each hop
4. **Path Reconstruction** - Backtracks from destination to source to build the optimal path

### Fee Calculation

Each hop applies a multiplicative 0.3% fee:

```
Output after hop = Input × (1 - 0.003)
```

For multiple hops:

```
Final output = Initial amount × (0.997)^n
where n = number of hops
```

### Supported Token Pairs

| From Token | Available To | Liquidity |
|-----------|--------------|-----------|
| XLM | USDC, USDT, BTC | High |
| USDC | XLM, USDT, ETH, BTC | Very High |
| USDT | XLM, USDC, ETH | High |
| BTC | XLM, USDC, ETH | Medium |
| ETH | USDC, USDT, BTC | High |

## Deployment

### Local Testing

```bash
npm run dev
```

### Production Deployment

1. Build the application:

```bash
npm run build
```

2. Set production environment variables:

```bash
export PORT=8080
export NODE_ENV=production
```

3. Start the server:

```bash
npm start
```

### Docker Support (Optional)

For containerized deployment, create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5001
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t nova-backend .
docker run -p 5001:5001 nova-backend
```

## Development

### Project Structure

- **`src/index.ts`** - Express app setup, middleware, and route handlers
- **`src/services/routerEngine.ts`** - Dijkstra algorithm and liquidity network graph

### Adding New Tokens

Edit `src/services/routerEngine.ts` and extend the `liquidityNetwork` object:

```typescript
private initializeLiquidityNetwork(): LiquidityNetwork {
  return {
    XLM: [ /* existing */ ],
    USDC: [ /* existing */ ],
    // Add new token
    NEWLY: [
      { target: "XLM", liquidity: 1000000, feePercentage: this.POOL_FEE },
      { target: "USDC", liquidity: 2000000, feePercentage: this.POOL_FEE },
    ],
  };
}
```

### Testing

Run the server and test endpoints with curl:

```bash
npm run dev

# In another terminal
curl "http://localhost:5001/api/swap-route?fromToken=XLM&toToken=BTC&amount=50"
```

## Performance Considerations

- **Algorithm Complexity** - O(V² + E) where V = tokens, E = pool connections
- **Response Time** - Typically <100ms for 5-token network
- **Memory Usage** - Minimal, scales linearly with network size
- **Concurrent Requests** - Handles hundreds of simultaneous requests

## License

MIT License - See LICENSE file for details

---

**NovaRoute Backend v1.0.0**
