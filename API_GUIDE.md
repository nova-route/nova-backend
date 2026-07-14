# NovaRoute API Usage Guide

## Quick Start

### 1. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start

# Server runs on http://localhost:5001
```

### 2. Health Check

Verify the server is running:

```bash
curl http://localhost:5001/health
```

**Response**:
```json
{
  "status": "ok",
  "service": "NovaRoute Backend"
}
```

## Endpoints

### GET /api/route

Calculate optimal swap route between two tokens.

#### Request

**URL**: `GET /api/route`

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenIn` | string | Yes | Source token symbol (e.g., "XLM", "USDC") |
| `tokenOut` | string | Yes | Target token symbol (e.g., "USDC", "ETH") |
| `amountIn` | string | Yes | Input amount in smallest unit as integer (no decimals) |

#### Examples

##### Example 1: Simple Swap (1 hop)

Swap 100 XLM for USDC.

```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"
```

**Breakdown**:
- `amountIn=100000000000000000000` = 100 × 10^18 = 100 XLM (assuming 18 decimal places)

**Response (200 OK)**:
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

**Interpretation**:
- **bestRoute**: XLM → USDC directly
- **poolPath**: Uses POOL-001 (XLM/USDC pool)
- **expectedAmountOut**: 19.93 USDC (19930000000000000000 ÷ 10^18)
- **priceImpact**: 0.0701% slippage
- **totalFeesApplied**: 0.2997 XLM (0.30% fee = 30 basis points)

---

##### Example 2: Multi-Hop Swap (2 hops)

Swap 100 XLM for ETH through USDC.

```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=ETH&amountIn=100000000000000000000"
```

**Response (200 OK)**:
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

**Interpretation**:
- **bestRoute**: XLM → USDC → ETH (2 hops)
- **poolPath**: Uses POOL-001 then POOL-003
- **expectedAmountOut**: 0.00985 ETH
- **priceImpact**: 0.1402% (cumulative fees across 2 hops)
- **totalFeesApplied**: 0.0505 XLM equivalent

---

##### Example 3: Maximum Hop Swap (3 hops)

Swap 100 XLM for BTC through USDC and ETH (maximum path depth).

```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=BTC&amountIn=100000000000000000000"
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "bestRoute": ["XLM", "USDC", "ETH", "BTC"],
    "poolPath": ["POOL-001", "POOL-003", "POOL-004"],
    "expectedAmountOut": "4850000000000000",
    "priceImpact": 0.2103,
    "totalFeesApplied": "105500000000000000"
  }
}
```

**Interpretation**:
- **bestRoute**: XLM → USDC → ETH → BTC (3 hops - maximum)
- **poolPath**: Uses POOL-001, POOL-003, POOL-004
- **expectedAmountOut**: 0.004850 BTC
- **priceImpact**: 0.2103% (3 cumulative fees)

---

### Error Responses

#### 400 Bad Request

**Missing parameter**:
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC"
# Missing amountIn
```

**Response**:
```json
{
  "success": false,
  "error": "amountIn is required",
  "statusCode": 400
}
```

---

**Invalid amount format**:
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=not_a_number"
```

**Response**:
```json
{
  "success": false,
  "error": "Amount must be a positive integer",
  "statusCode": 400,
  "details": {
    "providedValue": "not_a_number"
  }
}
```

---

**Negative amount**:
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=-1000"
```

**Response**:
```json
{
  "success": false,
  "error": "Amount must be greater than 0",
  "statusCode": 400,
  "details": {
    "providedValue": "-1000"
  }
}
```

---

#### 404 Not Found

**No route exists** (token not supported or no liquidity path):
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=DOGE&amountIn=100000000000000000000"
```

**Response**:
```json
{
  "success": false,
  "error": "No viable route found between XLM and DOGE",
  "statusCode": 404,
  "details": {
    "fromToken": "XLM",
    "toToken": "DOGE",
    "supportedTokens": ["BTC", "ETH", "USDC", "USDT", "XLM"]
  }
}
```

---

### GET /api/tokens

List all supported tokens in the routing engine.

#### Request

**URL**: `GET /api/tokens`

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "tokens": ["BTC", "ETH", "USDC", "USDT", "XLM"],
    "count": 5
  }
}
```

---

### GET /api/pool/:poolId

Get detailed information about a specific liquidity pool.

#### Request

**URL**: `GET /api/pool/:poolId`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `poolId` | string | Yes | Pool identifier (e.g., "POOL-001") |

#### Example

```bash
curl http://localhost:5001/api/pool/POOL-001
```

#### Response (200 OK)

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

**Interpretation**:
- **tokenA**: 5,000,000 XLM (5e24 ÷ 10^18)
- **tokenB**: 1,000,000 USDC
- **feeInBasisPoints**: 30 = 0.30% fee
- **Constant Product**: 5M × 1M = 5e12 (invariant k)

#### Error Response (404 Not Found)

```bash
curl http://localhost:5001/api/pool/INVALID-POOL
```

**Response**:
```json
{
  "success": false,
  "error": "Pool not found",
  "poolId": "INVALID-POOL"
}
```

---

## JavaScript/TypeScript Integration

### Fetch Implementation

```typescript
async function getSwapRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint
): Promise<void> {
  const url = new URL("http://localhost:5001/api/route");
  url.searchParams.append("tokenIn", tokenIn);
  url.searchParams.append("tokenOut", tokenOut);
  url.searchParams.append("amountIn", amountIn.toString());

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!data.success) {
    console.error("Error:", data.error);
    console.error("Details:", data.details);
    return;
  }

  const route = data.data;
  console.log("Best route:", route.bestRoute);
  console.log("Expected output:", route.expectedAmountOut);
  console.log("Price impact:", route.priceImpact + "%");
}

// Usage
await getSwapRoute(
  "XLM",
  "USDC",
  BigInt("100000000000000000000") // 100 XLM
);
```

---

### React Component Example

```typescript
import { useState } from "react";

export function SwapRouter() {
  const [tokenIn, setTokenIn] = useState("XLM");
  const [tokenOut, setTokenOut] = useState("USDC");
  const [amountIn, setAmountIn] = useState("100");
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCalculateRoute = async () => {
    setLoading(true);
    setError(null);

    try {
      const amountInWei = BigInt(amountIn) * BigInt(10) ** BigInt(18);
      const url = new URL("http://localhost:5001/api/route");
      url.searchParams.append("tokenIn", tokenIn);
      url.searchParams.append("tokenOut", tokenOut);
      url.searchParams.append("amountIn", amountInWei.toString());

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!data.success) {
        setError(data.error);
      } else {
        setRoute(data.data);
      }
    } catch (err) {
      setError("Failed to calculate route");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-router">
      <div>
        <label>
          Token In:
          <input
            type="text"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div>
        <label>
          Token Out:
          <input
            type="text"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div>
        <label>
          Amount In:
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
        </label>
      </div>

      <button onClick={handleCalculateRoute} disabled={loading}>
        {loading ? "Calculating..." : "Calculate Route"}
      </button>

      {error && <div className="error">{error}</div>}

      {route && (
        <div className="route-result">
          <p>Path: {route.bestRoute.join(" → ")}</p>
          <p>Output: {route.expectedAmountOut} {route.bestRoute[route.bestRoute.length - 1]}</p>
          <p>Price Impact: {route.priceImpact.toFixed(4)}%</p>
        </div>
      )}
    </div>
  );
}
```

---

## Computing Amount In (Decimal Conversion)

Since the API expects amounts in smallest unit (no decimals), you need to convert readable amounts:

### Formula
```
amountInWei = readableAmount × 10^decimals
```

### Examples

For tokens with 18 decimals (most common):

```
100 XLM = 100 × 10^18 = 100000000000000000000

1 XLM = 1 × 10^18 = 1000000000000000000

0.5 XLM = 0.5 × 10^18 = 500000000000000000

1000 USDC = 1000 × 10^6 = 1000000000
           (if USDC uses 6 decimals)
```

### JavaScript Conversion

```typescript
// For 18 decimals
function toWei(readable: number): bigint {
  return BigInt(Math.floor(readable * 1e18));
}

function fromWei(wei: bigint): number {
  return Number(wei) / 1e18;
}

// Usage
const amount = toWei(100); // 100 XLM in wei
// amount = 100000000000000000000n

const readable = fromWei(BigInt("100000000000000000000")); // 100
```

---

## API Response Schema

### Success Response

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

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": {
    "key": "value"
  }
}
```

---

## CURL Command Reference

### Single-Hop Route
```bash
curl -X GET "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"
```

### Multi-Hop Route
```bash
curl -X GET "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=ETH&amountIn=100000000000000000000"
```

### List Supported Tokens
```bash
curl -X GET "http://localhost:5001/api/tokens"
```

### Get Pool Details
```bash
curl -X GET "http://localhost:5001/api/pool/POOL-001"
```

### Health Check
```bash
curl -X GET "http://localhost:5001/health"
```

---

## Performance Tips

1. **Batch Requests**: Don't call API for every keystroke; debounce user input
2. **Cache Routes**: Store recently calculated routes to avoid redundant calls
3. **Preload Tokens**: Fetch supported tokens on app load
4. **Handle Timeouts**: Set reasonable fetch timeouts (5-10 seconds)

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

---

## Troubleshooting

### "Port 5001 already in use"

Kill the process using port 5001:

```bash
# macOS/Linux
lsof -ti:5001 | xargs kill -9

# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### "Connection refused"

Make sure the server is running:
```bash
npm run dev  # or npm start
```

### "No viable route found"

Check that both tokens are supported:
```bash
curl http://localhost:5001/api/tokens
```

If unsupported, the token isn't in the liquidity graph.

---

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider adding:

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use("/api/", limiter);
```

---

## Support

For issues or feature requests, check the [ROUTING_ENGINE.md](./ROUTING_ENGINE.md) documentation or examine the TypeScript source code in `src/services/`.
