import type { Metadata } from "next";
import { LegalPage } from "../legal-page";
import {
  GOVERNING_LAW,
  LEGAL_ENTITY,
  MERCHANT_OF_RECORD,
  SITE_NAME,
  SUPPORT_EMAIL,
} from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 September 2026">
      <p>
        This policy explains what personal data {LEGAL_ENTITY} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects when you use {SITE_NAME}, why we collect it,
        and what rights you have over it. For the purposes of data protection
        law, {LEGAL_ENTITY} is the controller of that data.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — your name and email address, and a
          securely hashed password. We never store your password in readable
          form.
        </li>
        <li>
          <strong>Your content</strong> — the projects, tabs, notes and files you
          choose to upload, together with their filenames, sizes and types.
        </li>
        <li>
          <strong>Subscription data</strong> — your current plan, and the
          customer and subscription identifiers issued by our payment provider.
        </li>
        <li>
          <strong>Technical data</strong> — server logs containing IP address,
          browser type and timestamps, generated automatically when you use the
          Service and used for security and debugging.
        </li>
      </ul>
      <p>
        We do not collect special category data, and we ask that you do not
        upload it.
      </p>

      <h2>2. Why we use it, and our legal bases</h2>
      <ul>
        <li>
          To provide the Service — storing and displaying your content, and
          operating your account. Legal basis: performance of a contract.
        </li>
        <li>
          To process subscriptions and prevent fraudulent payments. Legal basis:
          performance of a contract, and legitimate interests.
        </li>
        <li>
          To keep the Service secure, diagnose faults, and prevent abuse. Legal
          basis: legitimate interests.
        </li>
        <li>
          To send service messages about your account, such as billing or
          security notices. Legal basis: performance of a contract.
        </li>
      </ul>
      <p>
        We do not sell your personal data, we do not use your content for
        advertising, and we do not use it to train machine-learning models.
      </p>

      <h2>3. Payments</h2>
      <p>
        Payments are processed by {MERCHANT_OF_RECORD}, which acts as our
        Merchant of Record and is the seller of record for your purchase. Your
        card details are entered on and handled entirely by{" "}
        {MERCHANT_OF_RECORD} and never reach our servers.
      </p>
      <p>
        We receive only your plan, its status, and the customer and subscription
        identifiers needed to match a subscription to your account.{" "}
        {MERCHANT_OF_RECORD} processes your data as an independent controller
        under its own privacy policy, which governs the billing information you
        provide to it.
      </p>

      <h2>4. Who we share data with</h2>
      <p>
        We share data only with the providers needed to run the Service, each
        under contract and only to the extent required:
      </p>
      <ul>
        <li>
          <strong>Hosting and application delivery</strong> — to serve the
          application.
        </li>
        <li>
          <strong>Database, authentication and file storage</strong> — to hold
          your account and your uploaded content.
        </li>
        <li>
          <strong>{MERCHANT_OF_RECORD}</strong> — to take payments and manage
          subscriptions.
        </li>
      </ul>
      <p>
        We may also disclose data where legally required, or to establish or
        defend legal claims.
      </p>

      <h2>5. Where your data is held</h2>
      <p>
        Your data may be processed outside your country, including in the United
        States and the European Union. Where data is transferred internationally
        we rely on appropriate safeguards, such as the European
        Commission&rsquo;s Standard Contractual Clauses.
      </p>

      <h2>6. Security</h2>
      <p>
        Access to your projects and files is restricted to your account and
        enforced at the database and storage layer, not only in the interface.
        Files are served through short-lived signed links rather than public
        URLs, and traffic is encrypted in transit. No system is perfectly
        secure, and we cannot guarantee absolute security.
      </p>

      <h2>7. Retention and deletion</h2>
      <p>
        We keep your account data and content for as long as your account
        exists. Deleting a project removes it and its files. Deleting your
        account — which you can do yourself at any time from your settings —
        permanently removes your projects, notes and uploaded files.{" "}
        <strong>Deletion is immediate and cannot be undone.</strong>
      </p>
      <p>
        Limited records, such as billing and tax records held by our payment
        provider, may be retained where law requires it.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        delete, export or restrict the processing of your personal data, to
        object to processing carried out on the basis of legitimate interests,
        and to withdraw consent where processing relies on it.
      </p>
      <p>
        You can exercise most of these directly: your name is editable, and your
        content and account are deletable, from your settings. For anything else
        contact {SUPPORT_EMAIL}. You also have the right to complain to your
        local data protection authority.
      </p>

      <h2>9. Cookies</h2>
      <p>
        We use only the cookies necessary to keep you signed in and to keep the
        Service secure. We do not use advertising or third-party tracking
        cookies, so no cookie consent banner is required.
      </p>

      <h2>10. Children</h2>
      <p>
        The Service is not directed at children under 16, and we do not
        knowingly collect their personal data. If you believe a child has
        provided us with data, contact {SUPPORT_EMAIL} and we will delete it.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        notified to account holders by email or within the Service before taking
        effect, and the date above will be updated.
      </p>

      <h2>12. Contact</h2>
      <p>
        For any privacy question, or to exercise your rights, write to{" "}
        {SUPPORT_EMAIL}. {LEGAL_ENTITY} is established in {GOVERNING_LAW}.
      </p>
    </LegalPage>
  );
}
