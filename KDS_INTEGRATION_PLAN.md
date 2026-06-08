# OrderArt KDS — Integration Plan

**Date:** 2026-06-03
**Status:** Pending Manager Approval
**Projects:** `orderart-yii2` (backend) · `orderart-kds` (React frontend)

---

## Background

The KDS frontend (`orderart-kds`) is a fully built React 18 + Vite application that currently
displays **hardcoded mock data** from `src/data.js`. It has no live connection to any backend.

The Yii2 backend handles all real orders across 4 types and 5 sources, and currently routes
kitchen notifications only to **MQTT physical printers**. No HTTP call to the KDS app exists today.

**Goal:** When an order is placed or updated in Yii2, the KDS screen updates in real time — with
no page refresh, for every kitchen station simultaneously.

---

## Order Source Mapping

Both projects must agree on source strings. This table is required by both approaches.

| Yii2 `source` | Yii2 `ordertype` | KDS `source` string |
|---|---|---|
| `pos` | `3` — dine_in | `dine-in` |
| `pos` | `4` — table_order | `dine-in` |
| `pos` | `1` — take_away | `pos-takeaway` |
| `pos` | `2` — delivery | `pos-delivery` |
| `website` | `1` — take_away | `web-takeaway` |
| `website` | `2` — delivery | `web-delivery` |
| `uber` / UBEREATS tender | any | `uber` |
| `ai` | any | `ai-order` |
| `doordash` / `menulog` | any | `uber` *(reuse until dedicated role added)* |

---

## Current State — What Exists

```
Yii2 backend
  ├─ OrderService.php          ← creates/finalises POS orders
  ├─ UberEatsService.php       ← handles Uber webhook
  ├─ OrdersHelper.php          ← invokeSendToKitchenPrintNew()
  └─ jobs/orders/
       └─ PrintKitchenDocketsOnKitchenPrintersJobNew.php
            └─► MqttPrinterHelperNew  ──► MQTT broker ──► Physical printer

orderart-kds (React)
  ├─ src/App.jsx               ← useState(INITIAL_ORDERS) ← MOCK DATA ONLY
  ├─ src/data.js               ← hardcoded orders
  └─ WEBHOOK_API.md            ← full API spec (not yet implemented)
```

**What is missing:** a bridge between the Yii2 order events and the KDS React screen.

---

## Approach A — Self-Hosted Node.js Server + WebSocket

### Architecture

```
Yii2 backend
  └─► KdsOrderCreatedJob (queue)
        └─► POST /webhook/orders
                  │
                  ▼
        KDS Node.js server  (new — orderart-kds/server/index.js)
          ├─ stores orders in memory / Redis
          ├─ exposes REST  GET /api/orders, PATCH /bump, PATCH /reopen
          └─► WebSocket broadcast (ws://)
                    │
                    ▼
        React KDS app (browser)
          └─ useOrders() hook  ←  WebSocket client
```

### Files to create or change

#### 1. `common/components/KdsWebhookHelper.php` — NEW

Resolves the KDS source string from an Order, then dispatches a queue job.

```php
<?php
namespace common\components;

use common\models\Order;
use Yii;

class KdsWebhookHelper
{
    public static function resolveKdsSource(Order $order): string
    {
        if (in_array($order->source, ['uber', 'doordash', 'menulog'], true)
            || $order->tender === Order::UBEREATS) {
            return 'uber';
        }
        if ($order->source === Order::SOURCE_AI) return 'ai-order';
        if ($order->source === Order::SOURCE_WEBSITE) {
            return $order->getOrderType() === Order::ORDER_TYPE_DELIVERY
                ? 'web-delivery' : 'web-takeaway';
        }
        $type = $order->getOrderType();
        if ($type === Order::ORDER_TYPE_DINE_IN
            || $type === Order::ORDER_TYPE_TABLE_ORDER) return 'dine-in';
        if ($type === Order::ORDER_TYPE_DELIVERY)        return 'pos-delivery';
        return 'pos-takeaway';
    }

    public static function notifyNewOrder(Order $order): void
    {
        Yii::$app->queue->push(
            new \common\jobs\kds\KdsOrderCreatedJob(['order_id' => $order->id])
        );
    }

    public static function notifyOrderCancelled(Order $order): void
    {
        Yii::$app->queue->push(
            new \common\jobs\kds\KdsOrderCancelledJob(['order_id' => $order->id])
        );
    }
}
```

#### 2. `common/jobs/kds/KdsOrderCreatedJob.php` — NEW

Builds the canonical webhook payload and POSTs it to the KDS server.

```php
<?php
namespace common\jobs\kds;

use common\jobs\Job;
use common\models\Order;
use common\components\KdsWebhookHelper;
use GuzzleHttp\Client;
use Yii;

class KdsOrderCreatedJob extends Job
{
    public function execute($queue)
    {
        $order = Order::findOne($this->data['order_id']);
        if (!$order) return;

        $payload = [
            'source_ref'   => (string) $order->id,
            'source'       => KdsWebhookHelper::resolveKdsSource($order),
            'order_number' => '#' . $order->id,
            'placed_at'    => date('c', strtotime($order->created_at)),
            'scheduled_at' => $order->preferred_order_time
                                ? date('c', strtotime($order->preferred_order_time))
                                : null,
            'note'         => $order->instruction ?? null,
            'table'        => $order->isDineIn()
                                ? ['number' => (string) ($order->table_number ?? '?')]
                                : null,
            'customer'     => !$order->isDineIn()
                                ? ['name' => $order->customer_name ?? '']
                                : null,
            'items'        => $this->buildItems($order),
        ];

        $kdsUrl = Yii::$app->params['kds_webhook_url'];
        $secret = Yii::$app->params['kds_webhook_secret'];

        (new Client)->post($kdsUrl . '/webhook/orders', [
            'json'    => $payload,
            'headers' => [
                'X-OrderArt-Signature' => 'sha256=' . hash_hmac(
                    'sha256', json_encode($payload), $secret
                ),
                'X-Idempotency-Key' => (string) $order->id,
            ],
            'timeout' => 5,
        ]);
    }

    private function buildItems(Order $order): array
    {
        return array_map(fn($item) => [
            'item_ref'         => (string) $item->id,
            'name'             => $item->name,
            'qty'              => (int) $item->quantity,
            'comment'          => $item->instruction ?? null,
            'mods'             => [],          // extend to map modifiers
            'has_dietary_flag' => false,
        ], $order->orderItems);
    }
}
```

#### 3. `common/params.php` — EDIT (add 2 lines)

```php
'kds_webhook_url'    => 'http://localhost:4000',   // KDS server URL
'kds_webhook_secret' => 'change-this-secret',
```

#### 4. Call the helper from existing services — EDIT

In `common/services/OrderService.php`, after the order is placed/accepted:
```php
KdsWebhookHelper::notifyNewOrder($order);
```

In `common/services/UberEatsService.php`, after Uber order is saved:
```php
KdsWebhookHelper::notifyNewOrder($order);
```

#### 5. `orderart-kds/server/index.js` — NEW

The Node.js server that bridges Yii2 webhooks to WebSocket.

```js
import express    from 'express'
import { WebSocketServer } from 'ws'
import { createServer }    from 'http'

const app    = express()
const server = createServer(app)
const wss    = new WebSocketServer({ server })

app.use(express.json())

const orders  = new Map()   // in-memory; swap for Redis in production
const clients = new Set()

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data })
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg)
  }
}

// ── Webhooks from Yii2 ──────────────────────────────────────────────
app.post('/webhook/orders', (req, res) => {
  const o = {
    id:        `ord_${Date.now()}`,
    source_ref: req.body.source_ref,
    source:    req.body.source,
    num:       req.body.order_number,
    name:      req.body.table?.number
                 ? `Table ${req.body.table.number}`
                 : (req.body.customer?.name ?? 'Order'),
    placed_at: req.body.placed_at,
    sched:     req.body.scheduled_at ?? null,
    note:      req.body.note ?? null,
    status:    'open',
    elapsed:   0,
    items:     (req.body.items ?? []).map((it, i) => ({
      id:      `itm_${Date.now()}_${i}`,
      item_ref: it.item_ref,
      name:    it.name,
      qty:     it.qty,
      comment: it.comment ?? null,
      done:    false,
      mods:    it.mods ?? [],
      has_dietary_flag: !!it.has_dietary_flag,
    })),
  }
  orders.set(o.id, o)
  broadcast('order.created', o)
  res.status(201).json({ id: o.id, status: 'open' })
})

app.delete('/webhook/orders/:ref', (req, res) => {
  const o = [...orders.values()].find(x => x.source_ref === req.params.ref)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'cancelled'
  broadcast('order.cancelled', { id: o.id })
  res.json({ id: o.id })
})

// ── REST API for React KDS frontend ────────────────────────────────
app.get('/api/orders', (req, res) => {
  const status = req.query.status ?? 'open'
  const list   = [...orders.values()].filter(o =>
    status === 'all' || o.status === status
  )
  res.json({ orders: list })
})

app.patch('/api/orders/:id/bump', (req, res) => {
  const o = orders.get(req.params.id)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'completed'
  o.items  = o.items.map(i => ({ ...i, done: true }))
  broadcast('order.bumped', { id: o.id })
  res.json({ id: o.id, status: 'completed' })
})

app.patch('/api/orders/:id/reopen', (req, res) => {
  const o = orders.get(req.params.id)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'open'
  broadcast('order.reopened', { id: o.id })
  res.json({ id: o.id, status: 'open' })
})

app.patch('/api/orders/:id/items/:itemId', (req, res) => {
  const o    = orders.get(req.params.id)
  const item = o?.items.find(i => i.id === req.params.itemId)
  if (!o || !item) return res.status(404).json({ error: 'NOT_FOUND' })
  item.done = req.body.status === 'done'
  broadcast('item.toggled', { order_id: o.id, item_id: item.id, done: item.done })
  res.json({ order_id: o.id, item })
})

// ── WebSocket (KDS browser clients connect here) ────────────────────
wss.on('connection', ws => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
})

server.listen(4000, () => console.log('KDS server running on :4000'))
```

#### 6. `orderart-kds/src/hooks/useOrders.js` — NEW

```js
import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_KDS_URL ?? 'http://localhost:4000'
const WS  = import.meta.env.VITE_KDS_WS  ?? 'ws://localhost:4000'

export function useOrders() {
  const [orders, setOrders] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    fetch(`${API}/api/orders?status=all`)
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
  }, [])

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS)
      wsRef.current = ws

      ws.onmessage = ({ data }) => {
        const { event, data: d } = JSON.parse(data)
        setOrders(prev => {
          switch (event) {
            case 'order.created':   return [...prev, d]
            case 'order.cancelled': return prev.map(o => o.id === d.id ? { ...o, status: 'cancelled' } : o)
            case 'order.bumped':    return prev.map(o => o.id === d.id ? { ...o, status: 'completed' } : o)
            case 'order.reopened':  return prev.map(o => o.id === d.id ? { ...o, status: 'open' } : o)
            case 'item.toggled':    return prev.map(o => o.id === d.order_id
              ? { ...o, items: o.items.map(i => i.id === d.item_id ? { ...i, done: d.done } : i) }
              : o)
            default: return prev
          }
        })
      }

      ws.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  const bump   = id => fetch(`${API}/api/orders/${id}/bump`,   { method: 'PATCH' })
  const reopen = id => fetch(`${API}/api/orders/${id}/reopen`, { method: 'PATCH' })

  return { orders, setOrders, bump, reopen }
}
```

#### 7. `orderart-kds/src/App.jsx` — EDIT (3 lines change)

```jsx
// Remove this line:
import { INITIAL_ORDERS } from './data'

// Add this line:
import { useOrders } from './hooks/useOrders'

// Replace this line:
const [orders, setOrders] = useState(INITIAL_ORDERS)
// With this line:
const { orders, setOrders, bump, reopen } = useOrders()
```

#### 8. `orderart-kds/package.json` — EDIT (add server deps)

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "express": "^4.19.0",
  "ws": "^8.18.0"
}
```

### Pros

- **No monthly cost** — fully self-hosted
- **Data stays on your servers** — no order data sent to a third party
- **No vendor dependency** — you own the code end to end
- **Full control** — can add restaurant-level filtering, multi-station routing, audit log
- **Already fits the WEBHOOK_API.md spec** written for this project

### Cons

- Need to build and deploy the Node.js server
- Need to handle reconnection logic (already coded in the hook above)
- Need to manage server uptime / process management (PM2 or systemd)

---

## Approach B — Pusher (Third-Party Managed WebSocket)

### Architecture

```
Yii2 backend
  └─► KdsPusherJob (queue)
        └─► Pusher PHP SDK
              └─► Pusher Cloud  ──► Pusher JS SDK
                                          │
                                          ▼
                                  React KDS app (browser)
                                    channel: kds-{restaurant_id}
```

Pusher is a managed WebSocket service. Yii2 publishes events directly to Pusher; the React
app subscribes to a Pusher channel. **No Node.js server needed for real-time delivery.**

A lightweight Yii2 REST endpoint is still needed for bump/reopen/toggle actions from the KDS
(since Pusher is publish-only — it does not store or serve data).

### Files to create or change

#### 1. Install Pusher PHP SDK in Yii2

```
composer require pusher/pusher-php-server
```

#### 2. `common/components/KdsPusherHelper.php` — NEW

```php
<?php
namespace common\components;

use common\models\Order;
use Pusher\Pusher;
use Yii;

class KdsPusherHelper
{
    private static function pusher(): Pusher
    {
        $cfg = Yii::$app->params['pusher'];
        return new Pusher(
            $cfg['app_key'],
            $cfg['app_secret'],
            $cfg['app_id'],
            ['cluster' => $cfg['cluster'], 'useTLS' => true]
        );
    }

    private static function channel(int $restaurantId): string
    {
        return 'kds-' . $restaurantId;
    }

    public static function notifyNewOrder(Order $order): void
    {
        Yii::$app->queue->push(
            new \common\jobs\kds\KdsPusherOrderCreatedJob(['order_id' => $order->id])
        );
    }

    public static function notifyOrderCancelled(Order $order): void
    {
        self::pusher()->trigger(
            self::channel($order->resid),
            'order.cancelled',
            ['source_ref' => (string) $order->id]
        );
    }
}
```

#### 3. `common/jobs/kds/KdsPusherOrderCreatedJob.php` — NEW

```php
<?php
namespace common\jobs\kds;

use common\jobs\Job;
use common\models\Order;
use common\components\KdsWebhookHelper;
use Pusher\Pusher;
use Yii;

class KdsPusherOrderCreatedJob extends Job
{
    public function execute($queue)
    {
        $order  = Order::findOne($this->data['order_id']);
        if (!$order) return;

        $cfg    = Yii::$app->params['pusher'];
        $pusher = new Pusher(
            $cfg['app_key'], $cfg['app_secret'], $cfg['app_id'],
            ['cluster' => $cfg['cluster'], 'useTLS' => true]
        );

        $payload = [
            'id'           => (string) $order->id,
            'source_ref'   => (string) $order->id,
            'source'       => KdsWebhookHelper::resolveKdsSource($order),
            'num'          => '#' . $order->id,
            'name'         => $order->isDineIn()
                                ? 'Table ' . ($order->table_number ?? '?')
                                : ($order->customer_name ?? 'Order'),
            'placed_at'    => date('c', strtotime($order->created_at)),
            'sched'        => $order->preferred_order_time
                                ? date('c', strtotime($order->preferred_order_time))
                                : null,
            'note'         => $order->instruction ?? null,
            'status'       => 'open',
            'elapsed'      => 0,
            'items'        => array_map(fn($item) => [
                'id'      => (string) $item->id,
                'item_ref'=> (string) $item->id,
                'name'    => $item->name,
                'qty'     => (int) $item->quantity,
                'comment' => $item->instruction ?? null,
                'done'    => false,
                'mods'    => [],
                'has_dietary_flag' => false,
            ], $order->orderItems),
        ];

        $pusher->trigger('kds-' . $order->resid, 'order.created', $payload);
    }
}
```

#### 4. `common/params.php` — EDIT (add Pusher config)

```php
'pusher' => [
    'app_id'     => 'YOUR_APP_ID',
    'app_key'    => 'YOUR_APP_KEY',
    'app_secret' => 'YOUR_APP_SECRET',
    'cluster'    => 'ap4',   // Sydney cluster — closest to AU
],
```

#### 5. Call the helper from existing services — EDIT (same as Approach A)

```php
// In OrderService.php and UberEatsService.php:
KdsPusherHelper::notifyNewOrder($order);
```

#### 6. `orderart-kds/src/hooks/useOrders.js` — NEW (Pusher version)

```js
import { useState, useEffect } from 'react'
import Pusher from 'pusher-js'

const API          = import.meta.env.VITE_KDS_API_URL  // Yii2 REST endpoint base
const PUSHER_KEY   = import.meta.env.VITE_PUSHER_KEY
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER ?? 'ap4'

export function useOrders(restaurantId) {
  const [orders, setOrders] = useState([])

  // Fetch initial order list from Yii2 REST API
  useEffect(() => {
    fetch(`${API}/api/v1/kds/orders?restaurant_id=${restaurantId}`)
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
  }, [restaurantId])

  // Subscribe to Pusher channel for real-time updates
  useEffect(() => {
    const pusher  = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER })
    const channel = pusher.subscribe(`kds-${restaurantId}`)

    channel.bind('order.created',   d => setOrders(prev => [...prev, d]))
    channel.bind('order.cancelled', d => setOrders(prev =>
      prev.map(o => o.id === d.id ? { ...o, status: 'cancelled' } : o)
    ))
    channel.bind('order.bumped',    d => setOrders(prev =>
      prev.map(o => o.id === d.id ? { ...o, status: 'completed' } : o)
    ))
    channel.bind('order.reopened',  d => setOrders(prev =>
      prev.map(o => o.id === d.id ? { ...o, status: 'open' } : o)
    ))
    channel.bind('item.toggled',    d => setOrders(prev =>
      prev.map(o => o.id === d.order_id
        ? { ...o, items: o.items.map(i => i.id === d.item_id ? { ...i, done: d.done } : i) }
        : o)
    ))

    return () => pusher.disconnect()
  }, [restaurantId])

  // Bump / reopen still hit Yii2 REST API directly
  const bump   = id => fetch(`${API}/api/v1/kds/orders/${id}/bump`,   { method: 'PATCH' })
  const reopen = id => fetch(`${API}/api/v1/kds/orders/${id}/reopen`, { method: 'PATCH' })

  return { orders, setOrders, bump, reopen }
}
```

#### 7. Install Pusher JS SDK in KDS

```
npm install pusher-js
```

#### 8. Add a Yii2 KDS REST controller — NEW

Needed for initial order list + bump/reopen actions (Pusher is publish-only).

```php
// backend/controllers/KdsController.php  (or api module)
class KdsController extends \yii\rest\Controller
{
    public function actionOrders(int $restaurant_id): array
    {
        // return open orders for this restaurant formatted for KDS
    }

    public function actionBump(int $id): array
    {
        // mark order complete, trigger Pusher event
    }

    public function actionReopen(int $id): array
    {
        // reopen order, trigger Pusher event
    }
}
```

### Pros

- **No Node.js server to build or maintain** — Pusher handles all WebSocket infrastructure
- **Scales automatically** — Pusher handles thousands of simultaneous KDS connections
- **Auto-reconnect, presence channels, connection state** built in
- **Pusher Debug Console** — see every event in real time from the Pusher dashboard
- **Faster to implement** — skip server setup, deploy only PHP + React changes
- **Per-restaurant channels** — `kds-{restaurant_id}` isolates restaurants naturally

### Cons

- **Monthly cost** — Pusher Channels pricing (2026):
  - Sandbox: Free — 200 max connections, 200k messages/day
  - Starter: ~$49/month — 500 connections, 10M messages/month
  - Pro: ~$99/month — 2,000 connections
- **Order data sent through Pusher cloud** — not fully on-premises
- **Still need a Yii2 REST endpoint** for initial order load + bump/reopen
- **Vendor dependency** — if Pusher has an outage, KDS goes dark

---

## Approach C — Self-Hosted Node.js Server + SSE (Server-Sent Events)

### What is SSE?

SSE (Server-Sent Events) is a native browser protocol for **one-way streaming** from server to
client over a plain HTTP connection. The browser's built-in `EventSource` API handles it — no
library required. The KDS only needs to **receive** order updates from the server; bump/reopen
actions are still regular `PATCH` requests. This makes SSE a natural fit.

Compared to Approach A (WebSocket), SSE is simpler: no protocol upgrade, no `ws` package,
auto-reconnect is built into `EventSource` natively.

### Architecture

```
Yii2 backend
  └─► KdsOrderCreatedJob (queue)
        └─► POST /webhook/orders
                  │
                  ▼
        KDS Node.js server  (orderart-kds/server/index.js)
          ├─ stores orders in memory / Redis
          ├─ GET /api/orders/stream  ← SSE endpoint (persistent HTTP connection)
          ├─ GET /api/orders         ← initial load
          ├─ PATCH /api/orders/:id/bump
          └─► text/event-stream  ──► EventSource in browser
                    │
                    ▼
        React KDS app (browser)
          └─ useOrders() hook  ←  EventSource client (no library)
```

### How SSE differs from WebSocket (Approach A)

| | WebSocket | SSE |
|---|---|---|
| Direction | Bidirectional | Server → client only |
| Protocol | Upgrade from HTTP | Plain HTTP |
| Browser API | `new WebSocket(url)` | `new EventSource(url)` |
| Auto-reconnect | Manual (coded in hook) | **Built into EventSource** |
| Library needed | `ws` npm package | None |
| Proxy/load balancer | Needs WS support | Works with any HTTP proxy |
| HTTP/2 multiplexing | No | Yes |

### Files to create or change

#### 1–4. Yii2 side — identical to Approach A

`KdsWebhookHelper.php`, `KdsOrderCreatedJob.php`, `KdsOrderCancelledJob.php`, and the
`common/params.php` additions are exactly the same as Approach A. The Yii2 backend does not
know or care whether the KDS server uses WebSocket or SSE internally.

#### 5. `orderart-kds/server/index.js` — NEW (SSE version)

```js
import express from 'express'
import { createServer } from 'http'

const app    = express()
const server = createServer(app)

app.use(express.json())

const orders  = new Map()   // in-memory; swap for Redis in production
const clients = new Set()   // each entry is an SSE response object

function broadcast(event, data) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    res.write(chunk)
  }
}

// ── Webhooks from Yii2 ──────────────────────────────────────────────
app.post('/webhook/orders', (req, res) => {
  const o = {
    id:         `ord_${Date.now()}`,
    source_ref: req.body.source_ref,
    source:     req.body.source,
    num:        req.body.order_number,
    name:       req.body.table?.number
                  ? `Table ${req.body.table.number}`
                  : (req.body.customer?.name ?? 'Order'),
    placed_at:  req.body.placed_at,
    sched:      req.body.scheduled_at ?? null,
    note:       req.body.note ?? null,
    status:     'open',
    elapsed:    0,
    items:      (req.body.items ?? []).map((it, i) => ({
      id:       `itm_${Date.now()}_${i}`,
      item_ref: it.item_ref,
      name:     it.name,
      qty:      it.qty,
      comment:  it.comment ?? null,
      done:     false,
      mods:     it.mods ?? [],
      has_dietary_flag: !!it.has_dietary_flag,
    })),
  }
  orders.set(o.id, o)
  broadcast('order.created', o)
  res.status(201).json({ id: o.id, status: 'open' })
})

app.delete('/webhook/orders/:ref', (req, res) => {
  const o = [...orders.values()].find(x => x.source_ref === req.params.ref)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'cancelled'
  broadcast('order.cancelled', { id: o.id })
  res.json({ id: o.id })
})

// ── REST API for React KDS frontend ────────────────────────────────
app.get('/api/orders', (req, res) => {
  const status = req.query.status ?? 'open'
  res.json({ orders: [...orders.values()].filter(o =>
    status === 'all' || o.status === status
  )})
})

app.patch('/api/orders/:id/bump', (req, res) => {
  const o = orders.get(req.params.id)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'completed'
  o.items  = o.items.map(i => ({ ...i, done: true }))
  broadcast('order.bumped', { id: o.id })
  res.json({ id: o.id, status: 'completed' })
})

app.patch('/api/orders/:id/reopen', (req, res) => {
  const o = orders.get(req.params.id)
  if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
  o.status = 'open'
  broadcast('order.reopened', { id: o.id })
  res.json({ id: o.id, status: 'open' })
})

app.patch('/api/orders/:id/items/:itemId', (req, res) => {
  const o    = orders.get(req.params.id)
  const item = o?.items.find(i => i.id === req.params.itemId)
  if (!o || !item) return res.status(404).json({ error: 'NOT_FOUND' })
  item.done = req.body.status === 'done'
  broadcast('item.toggled', { order_id: o.id, item_id: item.id, done: item.done })
  res.json({ order_id: o.id, item })
})

// ── SSE endpoint — KDS browser clients connect here ────────────────
app.get('/api/orders/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send current open orders immediately on connect so the screen
  // is populated before any new events arrive
  const openOrders = [...orders.values()].filter(o => o.status !== 'cancelled')
  res.write(`event: snapshot\ndata: ${JSON.stringify(openOrders)}\n\n`)

  // Keep connection alive with a heartbeat every 25 seconds
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)

  clients.add(res)
  req.on('close', () => {
    clients.delete(res)
    clearInterval(heartbeat)
  })
})

server.listen(4000, () => console.log('KDS SSE server running on :4000'))
```

#### 6. `orderart-kds/src/hooks/useOrders.js` — NEW (SSE version)

Uses the native browser `EventSource` — no library needed.

```js
import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_KDS_URL ?? 'http://localhost:4000'

export function useOrders() {
  const [orders, setOrders] = useState([])
  const esRef = useRef(null)

  useEffect(() => {
    const es = new EventSource(`${API}/api/orders/stream`)
    esRef.current = es

    // Server sends current orders immediately on connect — no separate fetch needed
    es.addEventListener('snapshot', (e) => {
      setOrders(JSON.parse(e.data))
    })

    es.addEventListener('order.created', (e) => {
      const d = JSON.parse(e.data)
      setOrders(prev => [...prev, d])
    })

    es.addEventListener('order.cancelled', (e) => {
      const d = JSON.parse(e.data)
      setOrders(prev => prev.map(o =>
        o.id === d.id ? { ...o, status: 'cancelled' } : o
      ))
    })

    es.addEventListener('order.bumped', (e) => {
      const d = JSON.parse(e.data)
      setOrders(prev => prev.map(o =>
        o.id === d.id ? { ...o, status: 'completed' } : o
      ))
    })

    es.addEventListener('order.reopened', (e) => {
      const d = JSON.parse(e.data)
      setOrders(prev => prev.map(o =>
        o.id === d.id ? { ...o, status: 'open' } : o
      ))
    })

    es.addEventListener('item.toggled', (e) => {
      const d = JSON.parse(e.data)
      setOrders(prev => prev.map(o =>
        o.id === d.order_id
          ? { ...o, items: o.items.map(i =>
              i.id === d.item_id ? { ...i, done: d.done } : i
            )}
          : o
      ))
    })

    // EventSource auto-reconnects natively on error — no manual retry needed
    es.onerror = () => console.warn('SSE reconnecting...')

    return () => es.close()
  }, [])

  const bump   = id => fetch(`${API}/api/orders/${id}/bump`,   { method: 'PATCH' })
  const reopen = id => fetch(`${API}/api/orders/${id}/reopen`, { method: 'PATCH' })

  return { orders, setOrders, bump, reopen }
}
```

#### 7. `orderart-kds/src/App.jsx` — EDIT (same 3-line change as Approach A)

```jsx
// Remove:
import { INITIAL_ORDERS } from './data'

// Add:
import { useOrders } from './hooks/useOrders'

// Replace:
const [orders, setOrders] = useState(INITIAL_ORDERS)
// With:
const { orders, setOrders, bump, reopen } = useOrders()
```

#### 8. `orderart-kds/package.json` — EDIT (add `express` only — no `ws` needed)

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "express": "^4.19.0"
}
```

### Pros

- **Simplest real-time implementation** — `EventSource` is built into every modern browser,
  no JS library required on the client side
- **Auto-reconnect is free** — `EventSource` reconnects automatically with no extra code
- **No protocol upgrade** — SSE is plain HTTP, works through any reverse proxy (Nginx, Apache,
  Cloudflare) without special configuration
- **Less server code than WebSocket** — no `ws` package, no upgrade handling
- **HTTP/2 multiplexes SSE streams** — multiple KDS stations share one connection
- **No monthly cost** — fully self-hosted, same as Approach A
- **Data stays on your servers**

### Cons

- **One-way only** — server → client. Bump/reopen actions go via separate `PATCH` requests
  (not a real limitation for KDS since bump is already a separate action in `App.jsx`)
- **Max 6 concurrent SSE connections per domain on HTTP/1.1** — not an issue in practice
  since each KDS tablet is one connection, and HTTP/2 removes this limit entirely
- **Some older HTTP/1.1 proxies buffer the stream** — solved by ensuring the proxy sets
  `proxy_buffering off` (one Nginx config line)
- **Need to deploy and manage the Node.js server** — same as Approach A

---

## Comparison

| | Approach A — Node.js + WebSocket | Approach B — Pusher | Approach C — Node.js + SSE |
|---|---|---|---|
| **Real-time delivery** | WebSocket (self-hosted) | Pusher managed WebSocket | SSE over HTTP (self-hosted) |
| **Monthly cost** | $0 | $49–$99/month | $0 |
| **Data privacy** | On-premises | Through Pusher cloud | On-premises |
| **Build effort** | Medium | Low | **Lowest** |
| **Maintenance** | Own the server | None for real-time | Own the server |
| **Client library** | None (`ws` server-side only) | `pusher-js` | **None at all** |
| **Auto-reconnect** | Manual (coded in hook) | Built-in (Pusher SDK) | **Built into EventSource** |
| **Proxy/load balancer** | Needs WS config | Pusher handles it | Any HTTP proxy, no config |
| **Scalability** | Manual (Redis for multi-node) | Automatic | Manual (Redis for multi-node) |
| **Vendor risk** | None | Pusher outage = KDS down | None |
| **Fits WEBHOOK_API.md spec** | Yes — perfectly | Partial | Yes — perfectly |
| **Direction** | Bidirectional | Bidirectional | Server → client (sufficient for KDS) |

---

## Recommendation

**Fastest to ship, no cost → Approach C (SSE)**
Least code on the client side (`EventSource` is native), auto-reconnect is free, works
through any proxy. The KDS only needs to receive events — bidirectional comms are never
needed. SSE is the right tool for this exact pattern.

**No server to manage → Approach B (Pusher)**
If your team does not want to run a Node.js process, Pusher at $49/month removes that
concern entirely. Good for rapid pilots.

**Full WebSocket control → Approach A (Node.js + WebSocket)**
If you already have a Node.js process running (e.g. `orderart-pushdata-service`) and want
to extend it, WebSocket fits naturally alongside existing socket code.

---

## Shared Work (Required by All Approaches)

These tasks are identical regardless of which approach is chosen:

1. **`KdsWebhookHelper::resolveKdsSource()`** — the source mapping logic
2. **Call `notifyNewOrder()` in `OrderService.php`** after POS order creation
3. **Call `notifyNewOrder()` in `UberEatsService.php`** after Uber order creation
4. **Change `App.jsx`** — replace `useState(INITIAL_ORDERS)` with `useOrders()` hook
5. **Map order modifiers** — extend `buildItems()` to include mod labels from Yii2 order items

---

## Files Changed / Created Summary

### Approach A — Node.js + WebSocket

| File | Action |
|---|---|
| `common/components/KdsWebhookHelper.php` | Create |
| `common/jobs/kds/KdsOrderCreatedJob.php` | Create |
| `common/jobs/kds/KdsOrderCancelledJob.php` | Create |
| `common/params.php` | Edit — add `kds_webhook_url`, `kds_webhook_secret` |
| `common/services/OrderService.php` | Edit — add `KdsWebhookHelper::notifyNewOrder()` call |
| `common/services/UberEatsService.php` | Edit — add `KdsWebhookHelper::notifyNewOrder()` call |
| `orderart-kds/server/index.js` | Create |
| `orderart-kds/package.json` | Edit — add `express`, `ws` |
| `orderart-kds/src/hooks/useOrders.js` | Create |
| `orderart-kds/src/App.jsx` | Edit — 3 lines |

### Approach B — Pusher

| File | Action |
|---|---|
| `common/components/KdsWebhookHelper.php` | Create (shared) |
| `common/components/KdsPusherHelper.php` | Create |
| `common/jobs/kds/KdsPusherOrderCreatedJob.php` | Create |
| `common/params.php` | Edit — add `pusher` config block |
| `common/services/OrderService.php` | Edit — add `KdsPusherHelper::notifyNewOrder()` call |
| `common/services/UberEatsService.php` | Edit — add `KdsPusherHelper::notifyNewOrder()` call |
| `backend/controllers/KdsController.php` | Create — REST for initial load + bump/reopen |
| `orderart-kds/src/hooks/useOrders.js` | Create (Pusher version) |
| `orderart-kds/src/App.jsx` | Edit — 3 lines |
| `orderart-kds/package.json` | Edit — add `pusher-js` |

### Approach C — Node.js + SSE *(recommended)*

| File | Action |
|---|---|
| `common/components/KdsWebhookHelper.php` | Create (shared) |
| `common/jobs/kds/KdsOrderCreatedJob.php` | Create (shared with A) |
| `common/jobs/kds/KdsOrderCancelledJob.php` | Create (shared with A) |
| `common/params.php` | Edit — add `kds_webhook_url`, `kds_webhook_secret` |
| `common/services/OrderService.php` | Edit — add `KdsWebhookHelper::notifyNewOrder()` call |
| `common/services/UberEatsService.php` | Edit — add `KdsWebhookHelper::notifyNewOrder()` call |
| `orderart-kds/server/index.js` | Create (SSE version — no `ws` package) |
| `orderart-kds/package.json` | Edit — add `express` only |
| `orderart-kds/src/hooks/useOrders.js` | Create (EventSource version — no library) |
| `orderart-kds/src/App.jsx` | Edit — 3 lines |
