# P&AMS — Performance & Attendance Management System

Multi-tenant performance and attendance management system for a group of companies. Tracks employee performance across weighted parameters, manages attendance with strict geo-fencing, handles leave workflows, task assignment, salary/payroll, and generates anomaly reports.

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Components)
- **Language**: TypeScript (strict)
- **UI**: Tailwind CSS + shadcn/ui + Framer Motion
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5
- **Client State**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Railway, Neon, or local)

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and AUTH_SECRET
   ```

3. **Generate Prisma client and push schema:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Seed the database with sample data:**
   ```bash
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open http://localhost:3000**

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@pams.com | Admin@123 |
| Reviewer | reviewer@companyone.com | Reviewer@123 |
| Staff | staff1@companyone.com | Staff@123 |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login/register (unauthenticated)
│   ├── (dashboard)/        # Main app (authenticated)
│   │   ├── attendance/     # Attendance & geo-fencing
│   │   ├── leaves/         # Leave management
│   │   ├── tasks/          # Task management
│   │   ├── performance/    # Performance scores & bonuses
│   │   ├── salary/         # Salary & payroll
│   │   ├── reports/        # Reports & analytics
│   │   └── admin/          # Admin panels
│   └── api/                # API routes
├── components/             # React components
│   ├── layout/             # Sidebar, topbar, shell
│   └── ui/                 # shadcn/ui components
├── lib/                    # Utilities & core logic
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Prisma client
│   ├── geo.ts              # Geo-fencing (Haversine)
│   └── constants.ts        # App constants & config
├── types/                  # TypeScript types
└── middleware.ts            # Auth middleware
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed script
```

## Key Features

- **Performance Engine**: Weighted scoring with editable parameters, bonus 25%-225%
- **Attendance**: Strict GPS geo-fencing with WFH detection (5km rule)
- **Leave Management**: Advance notice requirements, emergency leave penalties, proof upload
- **Task Management**: Reviewer-assigned tasks with speed/accuracy scoring
- **Multi-Company**: Tenant-based isolation for 3-4 companies
- **RBAC**: Granular per-feature permissions per user
- **Anomaly Detection**: Daily automated anomaly reports via email

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Prisma Studio |
