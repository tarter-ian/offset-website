# Offset

A site where people see their monthly carbon footprint and offset it with donations to vetted climate charities.

This first version has:

- a two-minute questionnaire that estimates a monthly footprint in seven categories,
- a results page showing each category's estimate, its uncertainty margin and the monthly donation,
- a page explaining the method and sources,
- a waitlist for when account linking and payments open.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # calculator tests
```

The waitlist writes to `./local.db` by default. In production, set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` to a hosted libSQL database such as Turso (see `.env.example`).

## Where things live

- `src/lib/footprint.ts`: the calculator and the margin model
- `src/lib/factors.ts`, `src/lib/data/states.ts`: emission factors and state data, with sources
- `src/lib/pricing.ts`: placeholder donation rate and service fee
- `src/lib/charities.ts`: example charities, to be replaced by the vetted list
