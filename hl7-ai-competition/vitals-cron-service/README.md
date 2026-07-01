# vitals-cron-service

FastAPI service that, every `VITALS_CRON_INTERVAL_HOURS` (default 1), pulls each
patient's vitals (heart rate, SpO2, respiratory rate, blood pressure) from the
past interval out of apple-healthkit-simulator and forwards them as one batch
to `VITALS_CRON_TARGET_URL`. If `VITALS_CRON_TARGET_URL` is unset, the cycle
still runs and reports what it would have forwarded, but does not POST
anywhere — there is no downstream consumer built yet.

## Endpoints

- `GET /health` - liveness check
- `GET /status` - the last cycle's result (`null` if none has run yet)
- `POST /run-now` - run a cycle immediately, bypassing the hourly schedule (useful for testing without waiting)

## Configuration

| Env var | Default | Description |
|---|---|---|
| `VITALS_CRON_HEALTHKIT_URL` | `http://apple-healthkit-simulator:8000` | Source of vitals |
| `VITALS_CRON_TARGET_URL` | unset | Downstream URL to POST batches to |
| `VITALS_CRON_INTERVAL_HOURS` | `1` | Cycle interval |

## Development

```sh
make sync   # install deps
make test   # run pytest
make lint   # ruff check
```
