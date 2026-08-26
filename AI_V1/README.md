# Project README

See `Operations Intelligence Dashboard` for frontend demo.

# Demo helper

To populate the database with full-day dummy data (useful for dashboard charts), run:

```bash
python generate_dummy_data.py --date 2025-12-01 --days 1 --interval 5 --peak-hour 12 --peak-width 3
```

The script uses the `DATABASE_URL` environment variable (see `.env.example`).
