# OrderArt KDS — Webhook & REST API Specification

**Version:** 1.0
**Base URL:** `https://api.orderart.io`
**Protocol:** HTTPS only
**Authentication:** HMAC-SHA256 webhook signatures + Bearer token for REST endpoints

---

## Endpoint Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | `POST` | `/webhook/orders` | Receive a new order from any source |
| 2 | `PUT` | `/webhook/orders/:ref` | Order modified after placement |
| 3 | `DELETE` | `/webhook/orders/:ref` | Order cancelled (full or partial) |
| 4 | `GET` | `/api/orders` | List & filter orders |
| 5 | `PATCH` | `/api/orders/:id/bump` | Mark order complete |
| 6 | `PATCH` | `/api/orders/:id/reopen` | Reopen a completed order |
| 7 | `PATCH` | `/api/orders/:id/items/:itemId` | Toggle single item done/undone |

---

## Global Conventions

### Authentication

**Webhook endpoints** (`/webhook/*`) use HMAC-SHA256 signature verification:

```
X-OrderArt-Signature: sha256=<hex_digest>
```

The digest is computed over the raw request body using the shared secret configured per source. Each source may have its own secret.

**REST endpoints** (`/api/*`) require a Bearer token:

```
Authorization: Bearer <token>
```

### Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-OrderArt-Signature` | Webhooks only | HMAC-SHA256 of raw body |
| `X-Idempotency-Key` | Recommended | UUID v4 — used for deduplication |
| `Authorization` | REST only | `Bearer <token>` |

### Order Sources Enum

```
dine-in | pos-takeaway | pos-delivery | web-takeaway | web-delivery | uber | ai-order
```

### Order Status Enum

```
open | completed | cancelled
```

### Mod Type Enum

```
variant | remove | extra | add | dietary
```

### Idempotency

All `POST`, `PUT`, `PATCH`, and `DELETE` endpoints are idempotent by `X-Idempotency-Key` (24h TTL). Webhooks additionally deduplicate by `source` + `source_ref`. Replays return `200` with `"replayed": true`.

### Timestamps

All timestamps are ISO 8601 with timezone offset — `2026-05-24T14:30:00+05:30`.

### Error Envelope

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

---

## 1. POST /webhook/orders — Receive New Order

### Request Headers

| Header | Required | Notes |
|--------|----------|-------|
| `X-OrderArt-Signature` | Yes | HMAC-SHA256 of raw body |
| `X-Idempotency-Key` | Recommended | UUID v4 |
| `X-Source-Adapter` | Optional | e.g. `uber-eats-v3.1` |

### Request Body

```json
{
  "source_ref": "POS-20260524-00042",
  "source": "dine-in",
  "order_number": "#042",
  "placed_at": "2026-05-24T14:30:00+05:30",
  "scheduled_at": null,
  "customer": null,
  "table": {
    "number": "7",
    "cover_count": 3
  },
  "note": "Anniversary table — please add a candle",
  "items": [
    {
      "item_ref": "ITEM-001",
      "name": "Butter Chicken",
      "qty": 2,
      "comment": "One extra spicy",
      "has_dietary_flag": true,
      "mods": [
        { "type": "variant", "label": "Half Portion", "critical": false },
        { "type": "dietary", "label": "Nut Allergy", "critical": true }
      ]
    }
  ],
  "metadata": {}
}
```

> `has_dietary_flag` is denormalised — `true` if any mod is `type: dietary`. The server overrides this to `true` if a dietary mod is present but the flag is `false`. `critical: true` on a mod means it is always visible and cannot be dismissed on the display.

### AI Order Extension

Items from `ai-order` source may include:

```json
{
  "item_ref": "AI-UNRESOLVED",
  "name": "Paneer Tikka [uncertain]",
  "recognition_confidence": 0.61,
  "recognition_alternatives": ["Paneer Tikka", "Paneer Tika Masala"]
}
```

Items with confidence < 0.75 (configurable) are flagged with a warning badge on the KDS but the order is never held — it appears immediately.

### Success Response — 201 Created

```json
{
  "id": "ord_01HXYZ1234567890",
  "status": "open",
  "source_warning": null,
  "created_at": "2026-05-24T14:30:01+05:30"
}
```

### Idempotent Replay Response — 200 OK

```json
{
  "id": "ord_01HXYZ1234567890",
  "replayed": true,
  "message": "Order already received; returning cached response."
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `400` | `MISSING_REQUIRED_FIELD` | `source`, `source_ref`, `order_number`, `placed_at`, or `items` absent |
| `400` | `EMPTY_ITEMS_ARRAY` | `items` is `[]` |
| `400` | `INVALID_ITEM_QTY` | qty is 0, negative, fractional, or non-integer |
| `400` | `INVALID_MOD_QTY` | mod qty is 0 or negative when present |
| `400` | `MISSING_CUSTOMER_NAME` | non-dine-in order has no customer name |
| `400` | `MISSING_TABLE_NUMBER` | dine-in order has no table number |
| `400` | `INVALID_SOURCE` | source not in enum and `allow_unknown_source` is off |
| `400` | `PAYLOAD_TOO_LARGE` | body exceeds 256 KB |
| `401` | `SIGNATURE_INVALID` | HMAC mismatch |
| `401` | `SIGNATURE_MISSING` | header absent |
| `409` | `DUPLICATE_ORDER` | source_ref + source already exists (non-replay) |
| `422` | `SCHEDULED_IN_PAST` | `scheduled_at` predates `placed_at` minus 2-min grace |
| `429` | `RATE_LIMITED` | >100 deliveries/min from this source |
| `503` | `SERVICE_UNAVAILABLE` | KDS temporarily offline |

---

## 2. PUT /webhook/orders/:ref — Modify Order

Full replacement of mutable fields (`items`, `note`, `scheduled_at`). Immutable fields (`source`, `order_number`, `placed_at`, `table`, `customer`) are ignored if sent.

**Key behaviour:**
- Items unchanged between old and new payloads (same `item_ref` + `name`) **retain their done/pending status**
- Newly added items appear with a pulsing NEW badge at the top of the card
- Removed items show a strikethrough for 10 seconds before disappearing
- If the order was `completed`, modification automatically reopens it to `open`

### Request Body

```json
{
  "source": "web-takeaway",
  "modified_at": "2026-05-24T14:45:00+05:30",
  "reason": "Customer added item via app",
  "note": "Please pack cutlery",
  "scheduled_at": null,
  "items": [
    {
      "item_ref": "ITEM-001",
      "name": "Butter Chicken",
      "qty": 1,
      "comment": null,
      "mods": [],
      "has_dietary_flag": false
    }
  ]
}
```

### Success Response — 200 OK

```json
{
  "id": "ord_01HXYZ1234567890",
  "diff": {
    "items_added": [{ "item_ref": "ITEM-005", "name": "Mango Lassi", "qty": 2 }],
    "items_removed": [{ "item_ref": "ITEM-002", "name": "Garlic Naan" }],
    "items_modified": [],
    "note_changed": true,
    "scheduled_at_changed": false
  }
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `404` | `ORDER_NOT_FOUND` | No order with this source_ref |
| `409` | `ORDER_CANCELLED` | Cannot modify a cancelled order |
| `409` | `STALE_MODIFICATION` | A newer modification is already applied |
| `400` | `MODIFICATION_PREDATES_ORDER` | `modified_at` earlier than `placed_at` |
| `400` | `SOURCE_MISMATCH` | `source` differs from the original order |

---

## 3. DELETE /webhook/orders/:ref — Cancel Order

Supports full or partial cancellation via `cancelled_items`.

### Request Body

```json
{
  "source": "uber",
  "cancelled_at": "2026-05-24T14:50:00+05:30",
  "reason": "Customer cancelled via Uber Eats app",
  "cancelled_items": []
}
```

- `cancelled_items` empty or absent → **full cancellation**, order removed from queue, red alert on KDS for 5 seconds
- `cancelled_items` with specific `item_ref` values → **partial cancellation**, those items removed, order stays `open`

Response includes `"was_in_progress": true` if any item was already done.

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `404` | `ORDER_NOT_FOUND` | No order with this source_ref |
| `409` | `ALREADY_CANCELLED` | Order already cancelled |
| `400` | `INVALID_ITEM_REF` | A `cancelled_items` entry doesn't exist in the order |

---

## 4. GET /api/orders — List & Filter

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `status` | `open` | `open` \| `completed` \| `cancelled` \| `all` |
| `source` | — | Comma-separated: `uber,web-delivery` |
| `table` | — | Dine-in table number |
| `has_dietary_flag` | — | `true` = only orders with dietary mods |
| `from` / `to` | — | ISO 8601 date range on `placed_at` |
| `sort` | `placed_at:asc` | `placed_at:asc/desc` \| `scheduled_at:asc` |
| `limit` | `50` | Max 200 |
| `cursor` | — | Opaque cursor from previous response |

### Success Response — 200 OK

```json
{
  "orders": [
    {
      "id": "ord_01HXYZ1234567890",
      "source_ref": "POS-20260524-00042",
      "source": "dine-in",
      "order_number": "#042",
      "status": "open",
      "placed_at": "2026-05-24T14:30:00+05:30",
      "scheduled_at": null,
      "elapsed_seconds": 432,
      "table": { "number": "7", "cover_count": 3 },
      "note": "Anniversary table",
      "has_dietary_flag": true,
      "items": [
        {
          "id": "itm_01HXYZ111",
          "item_ref": "ITEM-001",
          "name": "Butter Chicken",
          "qty": 2,
          "status": "pending",
          "comment": "One extra spicy",
          "has_dietary_flag": true,
          "mods": [
            { "type": "variant", "label": "Half Portion", "critical": false },
            { "type": "dietary", "label": "Nut Allergy", "critical": true }
          ]
        }
      ]
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6Im9yZF8wMUhYWVoifQ==",
    "has_more": true,
    "total_open": 14,
    "total_completed_today": 87
  }
}
```

> `elapsed_seconds` is computed server-side at response time. Clients should seed their own timers from this value — never cache it.

---

## 5. PATCH /api/orders/:id/bump — Complete Order

### Request Body

```json
{
  "bumped_by": "station-2",
  "bumped_at": "2026-05-24T14:55:00+05:30"
}
```

All items are forced to `done` on bump regardless of their individual status. Response includes `undo_expires_at` (8 seconds out) for the KDS undo toast.

### Success Response — 200 OK

```json
{
  "id": "ord_01HXYZ1234567890",
  "order_number": "#042",
  "status": "completed",
  "bumped_by": "station-2",
  "bumped_at": "2026-05-24T14:55:00+05:30",
  "undo_expires_at": "2026-05-24T14:55:08+05:30"
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `409` | `ALREADY_COMPLETED` | Order already bumped — returns who bumped it and when |
| `409` | `ORDER_CANCELLED` | Cannot bump a cancelled order |
| `409` | `BUMP_CONFLICT` | Lost optimistic lock race — re-fetch and retry |

---

## 6. PATCH /api/orders/:id/reopen — Undo Bump

Item statuses are **preserved** on reopen. Order moves back to `open` and reappears on the KDS queue.

### Request Body

```json
{
  "reopened_by": "station-2",
  "reason": "Bumped by mistake"
}
```

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `409` | `ALREADY_OPEN` | Order is already open |
| `409` | `ORDER_CANCELLED` | Cannot reopen a cancelled order |

---

## 7. PATCH /api/orders/:id/items/:itemId — Toggle Item

### Request Body

```json
{
  "status": "done",
  "toggled_by": "station-1"
}
```

### Success Response — 200 OK

```json
{
  "order_id": "ord_01HXYZ1234567890",
  "order_number": "#042",
  "order_status": "open",
  "item": {
    "id": "itm_01HXYZ111",
    "name": "Butter Chicken",
    "qty": 2,
    "status": "done",
    "toggled_by": "station-1",
    "toggled_at": "2026-05-24T14:53:00+05:30"
  },
  "all_items_done": false
}
```

> `all_items_done: true` signals the KDS to surface a bump prompt when every item on the order is done.

### Error Responses

| HTTP | Code | Trigger |
|------|------|---------|
| `400` | `INVALID_STATUS` | status is not `done` or `pending` |
| `404` | `ITEM_NOT_FOUND` | No item with this ID on the order |
| `409` | `ORDER_CANCELLED` | Cannot toggle items on a cancelled order |
| `409` | `STATUS_UNCHANGED` | Item is already in the requested status |

---

## Edge Cases & Failure Modes

### 1. Duplicate Webhook Delivery (Retry Storm)
Deduplication on `source` + `source_ref` (primary) and `X-Idempotency-Key` (secondary, 24h TTL). Replays return `200` with `"replayed": true`. The **same key must be sent on every retry** — a new key bypasses deduplication and creates a duplicate order.

### 2. Order Arrives Already Past Scheduled Time
- `scheduled_at` < `placed_at` – 2 min → `422 SCHEDULED_IN_PAST` (malformed, reject)
- `scheduled_at` after `placed_at` but before `now` (pipeline delay) → accepted, `"schedule_warning": "SCHEDULED_TIME_ELAPSED"`, KDS shows overdue badge and sorts to top of queue

### 3. Concurrent Bump Race Condition
Optimistic concurrency via `etag` version counter. First bump advances `etag`. Second bump with stale `etag` gets `409 BUMP_CONFLICT`. All stations sync via WebSocket within ~200ms. Net result: exactly one bump recorded, one `bumped_by` in the audit log.

### 4. Uber Eats Non-Standard Format
Each source has a registered **adapter layer** that transforms to canonical schema before validation. Raw Uber payload stored verbatim in `metadata.raw_payload`. If the adapter fails → `400 ADAPTER_TRANSFORM_FAILED` with alert to integration team. Orders are never silently dropped.

### 5. AI Order Garbled Recognition
Items with `recognition_confidence` < 0.75 get a warning badge on the KDS. Alternatives shown, confirmation required before marking done. Order is **never held** — appears immediately. If an uncertain item also has `has_dietary_flag: true` → critical alert fires regardless of confidence.

### 6. Mid-Prep Order Modification
Added items get a pulsing NEW badge. Removed items show a 10-second strikethrough warning if already done. Items unchanged between versions retain their done/pending status. Completed orders are auto-reopened if a modification arrives.

### 7. Full Cancellation Mid-Prep
Full-screen red alert on KDS for 5 seconds. Response includes `"was_in_progress": true`. Cancelled orders are **never deleted** — full audit trail preserved, accessible via `GET /api/orders?status=cancelled`.

### 8. Partial Cancellation
Only listed `item_ref` values are removed, order stays `open`. If a removed item had `has_dietary_flag: true` → cross-contamination warning shown. If `cancelled_items` references a non-existent `item_ref` → `400 INVALID_ITEM_REF`.

### 9. Unknown Source Type
If `allow_unknown_source: true` in restaurant config → accepted with `"source_warning": "UNKNOWN_SOURCE"`, grey badge on KDS, alert to platform team. Otherwise → `400 INVALID_SOURCE`.

### 10. Malformed Payload
All validation errors returned at once in an `errors` array. Payloads > 256 KB rejected before parsing.

### 11. Signature Verification Failure
`401 SIGNATURE_INVALID` immediately — no parsing, no payload body logged. After 10 failures from same IP in 5 minutes → IP rate-limited + ops alert.

### 12. Webhook Response Timeout
Target p99 < 500ms. If slow → `202 Accepted` returned after writing to durable queue with `"processing": true`. Source retries using the same `X-Idempotency-Key`.

### 13. Zero or Negative Item Quantity
`400 INVALID_ITEM_QTY`. Fractional quantities also rejected. All quantities must be whole integers ≥ 1.

### 14. Two Open Orders at Same Table
Fully valid — no uniqueness constraint on table number. Both appear on KDS. `GET /api/orders?table=7` returns all. Single-order-per-table enforcement belongs at the POS layer.

### 15. Order Number Collision Across Sources
`order_number` is a display label only. Canonical identifier is always the internal `id`. Composite key `(source, source_ref)` is globally unique. KDS differentiates via source badge: "POS #042" vs "UBER #042".

### 16. Allergy / Dietary Flag — Never Silently Lost
- **Ingestion:** server overrides `has_dietary_flag` to `true` if a dietary mod is present regardless of the sent value
- **Modification:** removing a `critical: true` dietary mod emits `DIETARY_MOD_REMOVED` audit event + manager notification
- **Display:** `critical: true` mods render a persistent amber banner that cannot be dismissed, survives bump and reopen
- **Partial cancellation:** removing an item with `has_dietary_flag: true` shows cross-contamination warning

### 17. Bump on Already-Completed Order
`409 ALREADY_COMPLETED` with timestamp and station of the original bump. KDS handles silently — no error toast shown to staff. Audit log records the attempt for synchronisation latency analytics.

### 18. KDS Goes Offline — Orders Flood in on Reconnect
- During outage: sources receive `503`, should backoff with jitter
- On reconnect: deduplication applies normally, burst rate-limited at 100/min per source
- Orders sorted by `placed_at` (not arrival order) — kitchen sees oldest first
- All elapsed `scheduled_at` orders immediately flagged overdue
- Ops alert: "KDS reconnected — X queued orders ingested"
- If offline > 30 min → `STALE_ORDER_INGESTION` flag added for manager review

---

## Real-Time Events (WebSocket / SSE)

| Event | Trigger |
|-------|---------|
| `order.created` | Webhook received |
| `order.modified` | PUT webhook processed |
| `order.cancelled` | DELETE webhook processed |
| `order.bumped` | PATCH /bump |
| `order.reopened` | PATCH /reopen |
| `item.toggled` | PATCH /items/:itemId |
| `order.overdue` | Elapsed time exceeds configured threshold |
| `system.reconnected` | KDS back online after outage |

All stations converge to the same state within ~200ms of any mutation.

---

## Webhook Retry Schedule for Source Systems

```
Attempt 1:  immediate
Attempt 2:  +5 seconds
Attempt 3:  +15 seconds
Attempt 4:  +60 seconds
Attempt 5:  +5 minutes
Attempt 6+: +15 minutes ± 20% jitter

Max window: 30 min (POS) / 2 hours (web & delivery platforms)
```

The same `X-Idempotency-Key` must be sent on every retry. A new key on each retry bypasses deduplication and will create a duplicate order.

---

## Source-Specific Notes

| Source | Notes |
|--------|-------|
| `dine-in` | Must include `table.number`. No `customer` required. Multiple open orders per table are valid. |
| `pos-takeaway` | Must include `customer.name`. `scheduled_at` is the promised pickup time. |
| `pos-delivery` | Must include `customer.name`. `scheduled_at` is the promised delivery time. |
| `web-takeaway` | Same as `pos-takeaway`. Source adapter normalises web platform schema. |
| `web-delivery` | Same as `pos-delivery`. |
| `uber` | Uses the Uber Eats source adapter. `metadata.raw_payload` contains the full Uber payload. |
| `ai-order` | Items may include `recognition_confidence` and `recognition_alternatives`. Uncertain items (< 0.75) are flagged on KDS. |
