#!/bin/bash
# Run this after starting the dev server
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ingest
