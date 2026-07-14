# NovaRoute Liquidity Routing Engine

## Architecture Overview

The routing engine is built on a decoupled graph data structure where:
- **Nodes** represent tokens
- **Edges** represent AMM liquidity pools
- **Pathfinding** uses modified Dijkstra algorithm with BFS optimization
- **Calculations** use Constant Product Formula (CPF) with per-hop fee deduction

## Core Components

### 1. RouterService (routerEngine.ts)

The main service implementing the pathfinding algorithm.

#### Data Structures

```typescript
// Represents a single AMM pool
interface AMMPool {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;      // Reserve of token A
  reserveB: bigint;      // Reserve of token B
  feeInBasisPoints: number; // e.g., 30 for 0.30%
}

// Graph node (token) with outgoing edges (trading paths)
interface GraphNode {
  token: string;
  edges: GraphEdge[];
}

// Directed edge through a pool
interface GraphEdge {
  poolId: string;
  targetToken: string;
  reserveIn: bigint;
  reserveOut: bigint;
  feeInBasisPoints: number;
}

// Route calculation result
interface RouteResult {
  bestRoute: string[];        // [tokenIn, token1, ..., tokenOut]
  poolPath: string[];         // Pool IDs traversed
  expectedAmountOut: bigint;  // Output amount
  priceImpact: number;        // As percentage
  totalFeesApplied: bigint;   // Sum of fees
}
```

#### Key Methods

##### `findOptimalRoute(tokenIn, tokenOut, amountIn)`
- **Input**: Source token, destination token, input amount (BigInt)
- **Output**: RouteResult or null if no path exists
- **Process**:
  1. Validates inputs
  2. Returns null if tokens not in graph or amount ≤ 0
  3. Calls modified Dijkstra for optimal pathfinding
  4. Returns detailed route with price impact

##### `findOptimalPath(tokenIn, tokenOut, amountIn)` (Private)
- Modified Dijkstra algorithm with depth constraint
- **Max hops**: 3 (for gas efficiency)
- **Maximizes**: Output amount (not minimizes distance)
- **Constraints**: Respects pool liquidity and fee structures

#### Pathfinding Algorithm

The modified Dijkstra algorithm works as follows:

1. **Initialize**: Set distance[tokenIn] = amountIn, all others = 0
2. **Loop** (up to MAX_HOPS = 3 iterations):
   - Find unvisited token with maximum available amount
   - Mark as visited
   - For each neighbor:
     - Calculate output via CPF (see formula below)
     - Update if better path found
     - Track predecessor for path reconstruction
3. **Reconstruct**: Backtrack from tokenOut to tokenIn
4. **Return**: Route, poolPath, and calculations

### 2. Constant Product Formula (CPF)

The core DeFi equation implemented in `calculateCPFOutput()`:

```
x × y = k (invariant)

Output = (inputAfterFee × reserveOut) / (reserveIn + inputAfterFee)

Where:
  inputAfterFee = amountIn × (1 - fee/10000)
  fee is in basis points (e.g., 30 = 0.30%)
```

#### Example Calculation

For a swap on POOL-001 (XLM → USDC):
- Input: 1,000 XLM (1e18 in smallest units)
- Reserve XLM: 5M (5e24)
- Reserve USDC: 1M (1e24)
- Fee: 30 basis points (0.30%)

```
inputAfterFee = 1e18 × (10000 - 30) / 10000 = 9.97e17
output = (9.97e17 × 1e24) / (5e24 + 9.97e17)
       ≈ 0.1993... USDC (199.3 USDC in readable units)
```

### 3. Price Impact Calculation

Price impact represents slippage due to pool depletion:

```typescript
priceImpact = ((amountIn - amountOut) / amountIn) × 100
```

This percentage increases with:
- Larger trade size relative to pool depth
- More hops through smaller pools
- Higher cumulative fees

## Express API Endpoint

### GET /api/route

**Purpose**: Find optimal swap route between two tokens

**Query Parameters**:
- `tokenIn` (string): Source token symbol (e.g., "XLM")
- `tokenOut` (string): Target token symbol (e.g., "USDC")
- `amountIn` (string): Input amount in smallest unit as integer (e.g., "1000000000000000000")

**Example Request**:
```
GET /api/route?tokenIn=XLM&tokenOut=USDC&amountIn=1000000000000000000
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "bestRoute": ["XLM", "USDC"],
    "poolPath": ["POOL-001"],
    "expectedAmountOut": "199300000000000000",
    "priceImpact": 0.07,
    "totalFeesApplied": "2997000000000000"
  }
}
```

**Error Response (404 - No Path)**:
```json
{
  "success": false,
  "error": "No viable route found between UNKNOWN and USDC",
  "statusCode": 404,
  "details": {
    "fromToken": "UNKNOWN",
    "toToken": "USDC",
    "supportedTokens": ["BTC", "ETH", "USDC", "USDT", "XLM"]
  }
}
```

**Error Response (400 - Bad Input)**:
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

## Supported Tokens & Pools

### Current Token Set
- XLM (Stellar Lumens)
- USDC (USD Coin)
- USDT (Tether)
- ETH (Ethereum)
- BTC (Bitcoin)

### Liquidity Pools

| Pool ID | Token Pair | Fee | Reserve A | Reserve B |
|---------|-----------|-----|-----------|-----------|
| POOL-001 | XLM ↔ USDC | 0.30% | 5M XLM | 1M USDC |
| POOL-002 | USDC ↔ USDT | 0.05% | 1M USDC | 1M USDT |
| POOL-003 | USDC ↔ ETH | 0.30% | 2M USDC | 1k ETH |
| POOL-004 | ETH ↔ BTC | 0.30% | 1k ETH | 50 BTC |
| POOL-005 | XLM ↔ USDT | 0.30% | 3M XLM | 600k USDT |

### Example Multi-Hop Routes

1. **Direct Route (1 hop)**:
   - XLM → USDC via POOL-001
   
2. **2-Hop Route**:
   - XLM → USDC → ETH via POOL-001, POOL-003
   
3. **3-Hop Route (Maximum)**:
   - XLM → USDC → ETH → BTC via POOL-001, POOL-003, POOL-004

## Safety & Error Handling

### Input Validation
- Tokens must exist in graph
- Amount must be positive integer
- Amount validated as BigInt (arbitrary precision)

### Path Validation
- No route returned if:
  - Start or end token not in liquidity graph
  - No connecting path exists within 3 hops
  - Final output amount ≤ 0 (insufficient liquidity)
- HTTP 404 with friendly error message and available tokens

### Precision Guarantees
- BigInt arithmetic prevents floating-point errors
- All calculations preserve full precision until JSON serialization
- Output as strings in JSON (BigInt cannot be directly serialized)

## Performance Characteristics

### Time Complexity
- **Graph construction**: O(P) where P = number of pools
- **Pathfinding**: O(T² × E) where T = tokens, E = edges per token
  - With 5 tokens and ~2 edges/token: O(25 × 2) = O(50)
  - Limited by MAX_HOPS = 3
- **Per-request**: ~1-5ms on modern hardware

### Space Complexity
- **Graph storage**: O(T + P) for nodes and pools
- **Pathfinding state**: O(T) for distance and predecessor maps

### Scalability
- Current implementation optimized for < 100 tokens
- 3-hop limit ensures consistent gas efficiency
- Bidirectional pools reduce graph sparsity

## Integration Guide

### Using RouterService Directly

```typescript
import routerEngine from "./services/routerEngine.js";

// Find route
const result = routerEngine.findOptimalRoute(
  "XLM",
  "USDC",
  BigInt("1000000000000000000")
);

if (result) {
  console.log("Best path:", result.bestRoute);
  console.log("Output:", result.expectedAmountOut.toString());
  console.log("Price impact:", result.priceImpact + "%");
} else {
  console.log("No route found");
}
```

### Using via Express Endpoint

```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=1000000000000000000"
```

### Response Parsing in Frontend

```typescript
const response = await fetch(
  `/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=${amount}`
);
const result = await response.json();

if (result.success) {
  const outputAmount = BigInt(result.data.expectedAmountOut);
  console.log("You will receive:", outputAmount);
} else {
  console.error("Route calculation failed:", result.error);
}
```

## Future Enhancements

1. **Multi-Path Splitting**: Route a single trade across multiple paths
2. **Dynamic Fee Structures**: Fee tiers based on trade size
3. **Oracle Integration**: Real price feeds for improved impact calculation
4. **Gas Cost Optimization**: Factor in chain-specific gas costs
5. **Liquidity Aggregation**: Source from multiple DEXs simultaneously
6. **Historical Price Tracking**: Detect and avoid sandwich attacks
7. **Slippage Control**: Allow users to set tolerance levels

## Testing

### Unit Test Cases

1. **Direct swap**: tokenIn → tokenOut in 1 hop
2. **Multi-hop**: tokenIn → intermediate → tokenOut
3. **No path**: Disconnected tokens return null
4. **Same token**: tokenIn === tokenOut returns input amount
5. **Edge case amounts**: Very small and very large inputs
6. **Zero and negative**: Rejected by validation

### Example Test Data

```typescript
test("Direct swap XLM to USDC", () => {
  const result = routerEngine.findOptimalRoute(
    "XLM",
    "USDC",
    BigInt("1000000000000000000")
  );
  
  expect(result).not.toBeNull();
  expect(result!.bestRoute).toEqual(["XLM", "USDC"]);
  expect(result!.poolPath).toEqual(["POOL-001"]);
  expect(result!.expectedAmountOut).toBeGreaterThan(BigInt(0));
  expect(result!.priceImpact).toBeGreaterThan(0);
});
```

## Configuration

### Environment Variables

```env
PORT=5001                    # Server port
NODE_ENV=development        # development or production
```

### Build & Run

```bash
# Development (with hot reload)
npm run dev

# Build
npm run build

# Production
npm start
```

## Monitoring & Logging

### Key Metrics
- Route calculation time
- Cache hit rate (future)
- Average price impact
- Path length distribution
- Error rate and types

### Debugging

Enable detailed logging:
```typescript
// In routerEngine.ts
private DEBUG = process.env.DEBUG === "true";

// Then use:
if (this.DEBUG) console.log("Exploring token:", token);
```

## License

MIT
