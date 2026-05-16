# Printy — B.J. Santiago Inc.

AI-powered chat platform for a printing business. Customers request quotes, track orders, and file support tickets through a conversational interface. Admins manage the full order lifecycle from the same chat layer.

**Stack:** React 19 + TypeScript + Vite + Supabase + Netlify

---

## Features

### Customer
- Personalized greeting on login -- Printy surfaces pending items (quotes, orders, payments) proactively
- Quote request via natural conversation -- no forms, Printy extracts specs from the message
- Payment submission with order summary and inline payment details
- Order and quote status tracking
- Support ticket filing and threaded replies
- Valued customer tier -- same flow, higher priority, no upfront payment required

### Admin
- Prioritized briefing on login -- urgent items first, grouped by type
- Quote proposal drafting -- Printy auto-drafts from customer-confirmed specs, admin prices and sends
- Order creation from accepted quotes
- Payment verification with inline proof viewing
- Order status advancement through fulfillment states
- Support ticket review, reply, and resolution
- Service catalog management -- add, edit, inactivate services and categories
- About section and FAQ management
- Bulk content updates via uploaded documents

### Chat Design
- Chip-based suggested replies for navigation; typed confirmation for all irreversible actions
- Proactive -- Printy leads with information, not prompts
- Warm, concise tone; adapts to context (neutral for inquiries, empathetic for problems)
- No dead ends -- post-action chips always offer a next step

---

## User Roles

| Role | Notes |
|---|---|
| `customer` | Regular customers -- quote, pay, track, ticket |
| `customer` (valued) | Priority handling, no upfront payment, auto-urgent |
| `admin` | Full order and content management via chat |
| `superadmin` | KPI dashboard (currently disabled) |

---

## Local Dev

```bash
npm install
npx netlify dev
```

Runs at `localhost:8888`.

---

## Pending

- Database migrations: `user_addresses` table, drop legacy tables, seed location data
- Code fixes: location service queries, Netlify function auth, tool realignment
- End-to-end test: customer flows, admin flows, role isolation
- Knowledge base: product-aware spec suggestions per product type
