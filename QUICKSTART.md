# NovaRoute Backend - Quick Start Guide

## 30-Second Setup

```bash
cd nova-backend
npm install
npm run dev
```

Server runs on `http://localhost:5001`

## First API Call

### Terminal 1: Start Server
```bash
npm run dev
```

### Terminal 2: Test Endpoint
```bash
# Swap 100 XLM for USDC
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"
```

**Response**:
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

## Available Routes

### Single Hop (Direct)
```bash
# XLM → USDC
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"

# USDC → ETH
curl "http://localhost:5001/api/route?tokenIn=USDC&tokenOut=ETH&amountIn=50000000000000000000"
```

### Multi-Hop (Through intermediaries)
```bash
# XLM → USDC → ETH (2 hops)
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=ETH&amountIn=100000000000000000000"

# XLM → USDC → ETH → BTC (3 hops - maximum)
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=BTC&amountIn=100000000000000000000"
```

### Check Supported Tokens
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

### Pool Information
```bash
# Get POOL-001 details (XLM/USDC pool)
curl http://localhost:5001/api/pool/POOL-001
```

## Amount Conversion

The API expects amounts in the **smallest unit** without decimals. For 18-decimal tokens:

| Readable | Query Parameter |
|----------|-----------------|
| 1 token | `100000000000000000` |
| 10 tokens | `100000000000000000000` |
| 100 tokens | `1000000000000000000000` |
| 0.1 tokens | `100000000000000000` |

**Formula**: `readableAmount × 10^18`

### JavaScript Helper
```typescript
function toWei(readable: number): string {
  return (BigInt(readable) * BigInt(10) ** BigInt(18)).toString();
}

function fromWei(wei: string): number {
  return Number(BigInt(wei)) / 1e18;
}

// Usage
const amount = toWei(100); // "100000000000000000000"
const readable = fromWei("19930000000000000000"); // 19.93
```

## Response Explanation

```json
{
  "success": true,
  "data": {
    "bestRoute": ["XLM", "USDC"],
    // ↑ Token path: start with XLM, swap for USDC

    "poolPath": ["POOL-001"],
    // ↑ Pools used: POOL-001 is XLM/USDC pool

    "expectedAmountOut": "19930000000000000000",
    // ↑ You get this many smallest units of USDC
    //   = 19.93 USDC (divide by 10^18)

    "priceImpact": 0.0701,
    // ↑ Slippage: 0.07% loss from ideal price
    //   Due to: pool fee (0.30%)

    "totalFeesApplied": "299700000000000000"
    // ↑ Amount deducted from input as fee
    //   = 0.2997 XLM (the 0.30% fee)
  }
}
```

## Common Errors

### 400 - Bad Request (Missing Parameter)
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC"
# Missing: amountIn

Response:
{
  "success": false,
  "error": "amountIn is required",
  "statusCode": 400
}
```

### 400 - Bad Request (Invalid Amount)
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=abc"

Response:
{
  "success": false,
  "error": "Amount must be a positive integer",
  "statusCode": 400
}
```

### 404 - Not Found (No Route)
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=DOGE&amountIn=100000000000000000000"
# DOGE is not in the network

Response:
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

## Frontend Integration

### React Hook
```typescript
import { useState } from 'react';

export function useSwapRoute() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getRoute = async (tokenIn: string, tokenOut: string, amountIn: bigint) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL('http://localhost:5001/api/route');
      url.searchParams.append('tokenIn', tokenIn);
      url.searchParams.append('tokenOut', tokenOut);
      url.searchParams.append('amountIn', amountIn.toString());

      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return null;
      }

      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { getRoute, loading, error };
}

// Usage in component
function SwapForm() {
  const { getRoute, loading, error } = useSwapRoute();

  const handleSwap = async () => {
    const route = await getRoute('XLM', 'USDC', BigInt('100000000000000000000'));
    if (route) {
      console.log('You will receive:', route.expectedAmountOut);
      console.log('Price impact:', route.priceImpact + '%');
    }
  };

  return (
    <div>
      <button onClick={handleSwap} disabled={loading}>
        {loading ? 'Loading...' : 'Get Route'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

## File Structure

```
nova-backend/
├── src/
│   ├── index.ts
│   │   └─ Express server & endpoints
│   └── services/
│       ├── routerEngine.ts
│       │   └─ Core routing algorithm
│       ├── routerService.ts
│       │   └─ Input validation & response formatting
│       └── routerEngine.test.ts
│           └─ Unit tests
├── QUICKSTART.md ← You are here
├── ROUTING_ENGINE.md
│   └─ Full algorithm documentation
├── API_GUIDE.md
│   └─ Complete API reference
├── ARCHITECTURE.md
│   └─ System design & diagrams
├── IMPLEMENTATION_SUMMARY.md
│   └─ What was implemented
└── README.md
    └─ Project overview
```

## Next Steps

1. **Understand the Algorithm**: Read [ROUTING_ENGINE.md](./ROUTING_ENGINE.md)
2. **Full API Reference**: See [API_GUIDE.md](./API_GUIDE.md)
3. **System Design**: Check [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Integration Examples**: Browse [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

## Build & Deploy

### Development
```bash
npm run dev        # Hot reload enabled
```

### Production
```bash
npm run build      # Compile TypeScript
npm start          # Run compiled code
```

## Scripts Reference

| Command | What it does |
|---------|------------|
| `npm install` | Install dependencies |
| `npm run dev` | Development server (hot reload) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production build |

## Environment Variables

Create `.env` file:

```env
PORT=5001
NODE_ENV=development
```

Or use defaults (port 5001, development mode).

## Troubleshooting

### "Port 5001 already in use"
```bash
# Kill process on port 5001
# Linux/macOS:
lsof -ti:5001 | xargs kill -9

# Windows:
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### "Module not found" error
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

### CORS issues from frontend
```
The server has CORS enabled by default for localhost.
Make sure your frontend is on http://localhost:3000 (or configure in index.ts)
```

## Example Walkthrough

### Scenario: Swap 100 XLM for as much USDC as possible

**Step 1: Calculate amount in wei**
```
100 XLM × 10^18 = 100000000000000000000
```

**Step 2: Call API**
```bash
curl "http://localhost:5001/api/route?tokenIn=XLM&tokenOut=USDC&amountIn=100000000000000000000"
```

**Step 3: Parse response**
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

**Step 4: Interpret results**
- You swap 100 XLM
- Best path: Direct via POOL-001 (XLM/USDC pool)
- You receive: 19930000000000000000 ÷ 10^18 = **19.93 USDC**
- Fee paid: 299700000000000000 ÷ 10^18 = **0.2997 XLM** (0.30%)
- Price impact: **0.0701%** (slightly more than the base fee due to pool depth)

**Step 5: Execute swap on-chain**
Use bestRoute and poolPath to execute the actual swap on Stellar blockchain.

---

That's it! You're ready to use the NovaRoute backend. 🚀

For more details, see the other documentation files.
