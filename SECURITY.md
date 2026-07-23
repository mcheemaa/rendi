# Security

Rendi runs against your own ClickHouse, Postgres, and API keys. Keeping secrets out of
the repository is a hard rule: env files are gitignored, and the `.env*.example`
templates carry names only. User-facing queries run through a read-only database role;
writes happen only through guarded, server-side paths.

## Reporting a vulnerability

Email **cheemawrites@gmail.com** with the details and steps to reproduce. Please do
not open a public issue for security reports. You will get a reply as fast as a small
project can manage, usually within a few days, and credit in the fix if you want it.
