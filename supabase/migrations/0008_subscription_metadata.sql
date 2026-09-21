-- Atria — the subscription detail the billing page shows.
--
-- 0007 stored only what the app needed to *authorize* (which plan, and the
-- provider ids a webhook uses to find the user). These six are what a
-- customer needs to *understand* their subscription: is it healthy, when
-- does it next charge, and which card. All of it is a cache of the
-- provider's state, refreshed on every subscription webhook — the provider
-- remains the source of truth, and nothing here is used for access control.
-- That is why every column is nullable with no constraints: a free user has
-- none of it, and a webhook that arrives with a field missing should store
-- what it has rather than fail.

alter table public.users
  -- The provider's own status string ('active', 'past_due', 'expired', …),
  -- stored verbatim rather than mapped to an enum. It drives presentation
  -- only, and a provider adding a state should not require a migration
  -- before the webhook can record it.
  add column subscription_status text,
  add column subscription_renews_at timestamptz,
  -- Set only once a subscription is ending; null while it is renewing.
  add column subscription_ends_at timestamptz,
  -- Distinct from status: Lemon Squeezy flags a subscription cancelled the
  -- moment someone opts out, but they keep access until the period ends.
  -- So "cancelled" and "still active" are both true at the same time, and
  -- the UI needs to say "cancels on the 14th", not "cancelled".
  add column subscription_cancelled boolean not null default false,
  -- Display only — the last four digits and the brand are not card data in
  -- any sense that matters to PCI, and are all the provider hands back.
  add column card_brand text,
  add column card_last_four text;

-- No grant changes needed: 0007 revoked table-level UPDATE from
-- `authenticated` and granted back only (email, name). New columns are
-- therefore unwritable by users by default, which is what we want — these
-- are written solely by the webhook via the service role. Worth stating
-- because the inverse is the easy mistake: adding a column here and
-- assuming a later `grant update` line is needed would re-open the hole
-- 0007 closed.
