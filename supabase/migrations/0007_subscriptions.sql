-- Atria — subscription tracking on the user record.
--
-- Plan state lives on public.users rather than a separate table: a user has
-- exactly one plan at a time, and every check ("can they create another
-- project?") already has the user row in hand. A subscriptions table would
-- add a join to answer a single-column question.

create type public.subscription_tier as enum ('free', 'basic', 'pro');

alter table public.users
  add column plan public.subscription_tier not null default 'free',
  -- Stripe's own identifiers, stored so a webhook can find the user it is
  -- talking about. Null until the user first reaches checkout; a customer
  -- can exist without a live subscription (cancelled, or card on file
  -- only), so the two are deliberately independent rather than one column.
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

-- One Stripe customer maps to one user, and likewise for a subscription.
-- Unique indexes rather than constraints so nulls stay unconstrained —
-- every free user has null in both.
create unique index users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index users_stripe_subscription_id_idx
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- RLS: the existing "users can view own row" select policy already covers
-- reading `plan`. But that policy also lets a user UPDATE their own row —
-- which, without the grants below, means anyone can set their own plan to
-- 'pro' with a single PostgREST call. RLS decides which ROWS you may touch;
-- it says nothing about which COLUMNS.
--
-- Column-level privileges are the mechanism for that, and they only apply
-- once the table-level grant is gone: in Postgres a table-wide UPDATE
-- supersedes any column-level revoke, so revoking the three billing columns
-- on their own would be a silent no-op. Revoke the table grant first, then
-- grant back exactly the columns a user may edit.
--
-- Billing is written only by Stripe webhooks using the service role, which
-- bypasses RLS and these grants entirely.
revoke update on public.users from authenticated;
grant update (email, name) on public.users to authenticated;
