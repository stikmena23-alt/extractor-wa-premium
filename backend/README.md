# Backend

This directory centralises the Supabase-facing logic that powers the admin portal.
It is split into two parts:

- `src/`: shared helpers imported by the Supabase Edge Functions in `supabase/functions/`.
- `migrations/`: SQL scripts that need to exist in your Supabase project before the
  recovery flow can work.

## Database schema

Run the migrations before deploying the functions:

```bash
supabase db push
```

The initial migration (`0001_create_admin_password_resets.sql`) provisions the
`admin_password_resets` table used to store recovery tokens. The schema mirrors the
fields that the backend expects (`token_hash`, `code_hash`, `short_code`, timestamps,
metadata, etc.) and adds helpful indexes for lookup.

## Environment variables

The code in `src/` relies on the following runtime variables:

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Project URL used by the Edge Functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key so the functions can manage auth users. |
| `ADMIN_APP_URL` | ⛔ | Optional. Base URL of the admin interface. Used to build recovery links. |
| `ADMIN_RECOVERY_BASE_URL` | ⛔ | Optional. Overrides the password reset link if you host the reset screen elsewhere. |
| `ADMIN_RECOVERY_EXP_MINUTES` | ⛔ | Optional. Custom expiration time (in minutes) for recovery tokens. |

If `ADMIN_RECOVERY_BASE_URL` is not set the system falls back to
`${ADMIN_APP_URL}/reset-password`. When neither value is provided a sensible default
(`https://wf-tools-admin.example.com`) keeps local development working.

## Deployment checklist

1. Apply the migrations to Supabase.
2. Deploy the Edge Functions located in `supabase/functions/admin-issue-password-reset` and
   `supabase/functions/admin-complete-password-reset`.
3. Expose the functions via HTTPS (the Supabase CLI does this automatically).
4. Wire the admin UI to the deployed URLs and ensure the environment variables above
   are configured in the Supabase dashboard for the functions.

With the schema and environment configured, admins can request recovery codes from the
panel, receive the generated link/QR/short-code, and complete the password reset flow
through the supplied form.
