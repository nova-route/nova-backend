# NovaRoute Pathfinding Engine (Backend)

A high-performance Node.js/TypeScript Express server implementing advanced graph-based pathfinding algorithms to compute optimal multi-hop token trade routes across decentralized finance (DeFi) liquidity pools on the Stellar network.

## Overview

The NovaRoute backend is built on modern web technologies and provides a robust REST API for discovering the most efficient token swap paths. It implements a **modified Dijkstra algorithm with BFS optimization** to analyze a graph-based liquidity network and determine the route that maximizes output amount while accounting for per-hop AMM fees using the **Constant Product Formula (x×y=k)**.

### Core Features

- **Decoupled Graph Data Structure** - Tokens as nodes, AMM pools as directed edges
- **Modified Dijkstra + BFS Pathfinding** - Maximizes output across multi-hop routes
- **Constant Product Formula (CPF)** - Accurate AMM calculations (x*y=k invariant)
- **Per-Hop Fee Deduction** - Dynamic basis point fees at each swap step
- **3-Hop Maximum Depth** - Gas-efficient routes for on-chain execution
- **BigInt Precision Math** - Arbitrary precision arithmetic prevents floating-point errors
- **Price Impact Calculation** - Quantifies slippage from optimal price
- **Type-Safe Implementation** - Full TypeScript with strict mode for production reliability
- **RESTful API** - Clean, standardized JSON endpoints with comprehensive validation
- **Error Handling** - Structured HTTP error responses with helpful debugging info

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

### Main Endpoint: GET /api/route

Computes the optimal multi-hop token swap route using modified Dijkstra pathfinding with CPF calculations.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Source token ticker (e.g., XLM, USDC) |
| `tokenOut` | string | Yes | Destination token ticker |
| `amountIn` | string | Yes | Input amount in smallest unit as BigInt integer (no decimals) |

#### Request Example

```bash
# Swap 100 XLM for USDC
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "bestRoute": ["XLM", "USDC"],
    "poolPath": ["POOL-001"],
    "expectedAmountOut": "19930000000000000000",
    "priceImpact": 0.0701,
    "totalFeesApplied": "299700000000000000"
  }
}
```

**Field Descriptions**:
- **bestRoute**: Token path [tokenIn, intermediary..., tokenOut]
- **poolPath**: Pool IDs traversed (e.g., POOL-001)
- **expectedAmountOut**: Output amount in smallest unit (BigInt as string)
- **priceImpact**: Slippage percentage from optimal 1:1 price
- **totalFeesApplied**: Sum of all fees deducted (in tokenIn units)

#### Multi-hop Example Response

Route: XLM → USDC → ETH (2 hops, maximum gas efficiency):

```json
{
  "success": true,
  "data": {
    "bestRoute": ["XLM", "USDC", "ETH"],
    "poolPath": ["POOL-001", "POOL-003"],
    "expectedAmountOut": "9850000000000000",
    "priceImpact": 0.1402,
    "totalFeesApplied": "50500000000000000"
  }
}
```

#### Error Response (400 Bad Request)

Missing parameters:

```json
{
  "success": false,
  "error": "amountIn is required",
  "statusCode": 400
}
```

Invalid amount:

```json
{
  "success": false,
  "error": "Amount must be a positive integer",
  "statusCode": 400,
  "details": {
    "providedValue": "-100"
  }
}
```

#### Error Response (404 Not Found)

No viable route exists:

```json
{
  "success": false,
  "error": "No viable route found between XLM and UNKNOWN",
  "statusCode": 404,
  "details": {
    "fromToken": "XLM",
    "toToken": "UNKNOWN",
    "supportedTokens": ["BTC", "ETH", "USDC", "USDT", "XLM"]
  }
}
```

### Additional Endpoints

#### GET /api/tokens
List all supported tokens:

```bash
curl http://localhost:5001/api/tokens
```

Response:
```json
{
  "success": true,
  "data": {
    "tokens": ["BTC", "ETH", "USDC", "USDT", "XLM"],
    "count": 5
  }
}
```

#### GET /api/pool/:poolId
Get details of a specific pool:

```bash
curl http://localhost:5001/api/pool/POOL-001
```

Response:
```json
{
  "success": true,
  "data": {
    "poolId": "POOL-001",
    "tokenA": "XLM",
    "tokenB": "USDC",
    "reserveA": "5000000000000000000000000",
    "reserveB": "1000000000000000000000000",
    "feeInBasisPoints": 30
  }
}
```

## Pathfinding Algorithm Details

### Modified Dijkstra with BFS

The router engine uses a **modified Dijkstra algorithm** optimized for AMM pathfinding:

**Algorithm Flow**:
1. **Graph Initialization** - Builds directed graph from AMM pools
   - Nodes: Tokens (XLM, USDC, USDT, ETH, BTC)
   - Edges: Pools with reserves and fees (bidirectional)
2. **Distance Tracking** - Maintains output amounts reachable at each depth
3. **Depth Constraint** - Maximum 3 hops for gas efficiency
4. **Hop Processing**:
   - Apply per-hop fee in basis points
   - Calculate output via Constant Product Formula
   - Update distance if better path found
5. **Path Reconstruction** - Backtrack using predecessor map
6. **Price Impact** - Calculate slippage from ideal 1:1 conversion

**Complexity**: O(T² × E) where T = tokens, E = edges. With MAX_HOPS=3, typically completes in <5ms.

### Constant Product Formula (CPF)

All AMM calculations follow the invariant: **x × y = k**

```
Output = (inputAfterFee × reserveOut) / (reserveIn + inputAfterFee)

Where:
  inputAfterFee = amountIn × (10000 - feeInBasisPoints) / 10000
  Fee is deducted before reserves are updated
```

**Example**:
- Input: 100 XLM
- Reserve XLM: 5,000,000
- Reserve USDC: 1,000,000
- Fee: 30 basis points (0.30%)

```
inputAfterFee = 100 × (10000 - 30) / 10000 = 99.7 XLM
output = (99.7 × 1,000,000) / (5,000,000 + 99.7) ≈ 19.93 USDC
```

### Price Impact

Represents slippage due to pool depletion:

```
priceImpact% = ((amountIn - amountOut) / amountIn) × 100
```

Increases with:
- Larger trade size relative to pool depth
- More hops through smaller pools
- Higher cumulative fees

### Supported Token Pairs & Pools

| Pool ID | Pair | Fee | Reserves |
|---------|------|-----|----------|
| POOL-001 | XLM ↔ USDC | 0.30% | 5M / 1M |
| POOL-002 | USDC ↔ USDT | 0.05% | 1M / 1M |
| POOL-003 | USDC ↔ ETH | 0.30% | 2M / 1k |
| POOL-004 | ETH ↔ BTC | 0.30% | 1k / 50 |
| POOL-005 | XLM ↔ USDT | 0.30% | 3M / 600k |

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

## Documentation

For detailed information about the routing engine, API usage, and integration:

- **[ROUTING_ENGINE.md](./ROUTING_ENGINE.md)** - Architecture, data structures, algorithm details
- **[API_GUIDE.md](./API_GUIDE.md)** - Complete API reference with examples and integration guides

## Development

### Key Files

- **`src/index.ts`** - Express server setup and API endpoints
- **`src/services/routerEngine.ts`** - Core routing algorithm and graph data structure
- **`src/services/routerService.ts`** - Input validation and response formatting
- **`src/services/routerEngine.test.ts`** - Unit tests for all routing functions

### Adding New Tokens/Pools

Edit `routerEngine.ts` and update `createSamplePools()`:

```typescript
private createSamplePools(): AMMPool[] {
  return [
    // ... existing pools
    {
      poolId: "POOL-NEW",
      tokenA: "NEWTOKEN",
      tokenB: "USDC",
      reserveA: BigInt("1000000000000000000000000"),
      reserveB: BigInt("500000000000000000000000"),
      feeInBasisPoints: 30,
    },
  ];
}
```

### Building & Testing

```bash
# Development (hot reload)
npm run dev

# Build
npm run build

# Run tests
npm run build
npm start

# In another terminal, test endpoints:
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=1000000000000000000000"
```

## Performance & Precision

### Strengths

- **Arbitrary Precision**: BigInt arithmetic prevents floating-point errors
- **Gas Efficient**: 3-hop maximum caps on-chain transaction costs
- **Fast Pathfinding**: O(T²) complexity completes in <5ms for typical networks
- **Scalable**: Designed for 50-100+ tokens
- **Safe**: Full TypeScript strict mode with input validation

### BigInt Considerations

All amounts are strings in JSON (BigInt cannot serialize directly):

```typescript
// Frontend receives:
{ "expectedAmountOut": "19930000000000000000" }

// Convert to BigInt for math:
const amount = BigInt("19930000000000000000");

// Convert to readable (18 decimals):
const readable = amount / BigInt("1000000000000000000"); // 19 tokens
```

## License

MIT License - See LICENSE file for details

---

**NovaRoute Backend v1.0.0**
