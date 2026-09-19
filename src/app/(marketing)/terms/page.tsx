import type { Metadata } from "next";
import { LegalPage } from "../legal-page";
import {
  GOVERNING_LAW,
  LEGAL_ENTITY,
  MERCHANT_OF_RECORD,
  SITE_NAME,
  SUPPORT_EMAIL,
} from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="19 September 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of{" "}
        {SITE_NAME} (the &ldquo;Service&rdquo;), operated by {LEGAL_ENTITY}{" "}
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the
        Service you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        {SITE_NAME} is a web application for organising the digital materials of
        real-world projects — documents, images, videos and notes — into
        projects and tabs. We may add, change or remove features over time.
      </p>

      <h2>2. Eligibility and your account</h2>
      <p>
        You must be at least 16 years old, or the minimum age of digital consent
        where you live, to use the Service. You are responsible for keeping your
        login credentials confidential and for all activity that occurs under
        your account. Tell us promptly at {SUPPORT_EMAIL} if you believe your
        account has been accessed without your permission.
      </p>

      <h2>3. Your content</h2>
      <p>
        You retain all ownership of the files, notes and other material you
        upload (&ldquo;Your Content&rdquo;). You grant us a limited, worldwide,
        non-exclusive licence to host, store, process, transmit and display Your
        Content solely to operate and provide the Service to you. This licence
        exists only so we can run the Service and ends when you delete the
        content or your account.
      </p>
      <p>
        You are responsible for Your Content and for having the rights necessary
        to upload it. We do not claim ownership of it and do not use it to train
        machine-learning models or for advertising.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>store or share material that is unlawful in your jurisdiction;</li>
        <li>infringe the intellectual property or privacy rights of others;</li>
        <li>distribute malware, or attempt to breach or probe our security;</li>
        <li>
          place unreasonable load on the Service, or resell it without our
          written permission.
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that breach this section, where
        practicable after notice.
      </p>

      <h2>5. Plans and billing</h2>
      <p>
        The Service is offered on a free plan and on paid subscription plans.
        Plan limits — such as the number of projects and the amount of storage
        available — are described on our pricing page and enforced by the
        Service.
      </p>
      <p>
        Paid subscriptions are billed in advance on a recurring monthly basis at
        the price shown at the time of purchase, and renew automatically until
        cancelled. Prices are stated in US dollars and may exclude sales tax or
        VAT, which is calculated and added at checkout where applicable.
      </p>

      <h2>6. Payments and Merchant of Record</h2>
      <p>
        Payments are processed securely by {MERCHANT_OF_RECORD}, which acts as
        the Merchant of Record for all purchases. This means{" "}
        {MERCHANT_OF_RECORD} — not {LEGAL_ENTITY} — is the seller of record on
        your order, handles the transaction, and is responsible for collecting
        and remitting applicable sales tax and VAT.
      </p>
      <p>
        Your payment card details are entered on and handled by{" "}
        {MERCHANT_OF_RECORD} and are never transmitted to or stored on our
        servers. We receive only the identifiers needed to associate a
        subscription with your account, together with your plan and its status.
        Your purchase is also subject to {MERCHANT_OF_RECORD}&rsquo;s own terms.
      </p>

      <h2>7. Refunds</h2>
      <p>
        <strong>
          All payments are final and non-refundable, except where a refund is
          required by law.
        </strong>{" "}
        We do not provide refunds or credits for partial subscription periods,
        unused time, downgrades, or periods during which you did not use the
        Service.
      </p>
      <p>
        Because a free plan is available indefinitely, we encourage you to
        evaluate the Service before subscribing. If you believe you have been
        charged in error, contact us at {SUPPORT_EMAIL} and we will investigate.
        Statutory rights that cannot be excluded — including any mandatory
        consumer right of withdrawal in your jurisdiction — are unaffected by
        this section.
      </p>

      <h2>8. Cancellation and termination</h2>
      <p>
        You may cancel your subscription at any time from your account settings.
        Cancellation stops future renewals; your paid plan remains active until
        the end of the billing period you have already paid for, after which the
        account reverts to the free plan. No refund is issued for the remainder
        of that period.
      </p>
      <p>
        You may delete your account at any time from your settings. Deletion is
        permanent and removes your projects, notes and uploaded files. We may
        suspend or terminate an account that materially breaches these Terms.
      </p>

      <h2>9. Availability and changes</h2>
      <p>
        We aim to keep the Service available and reliable, but it is provided
        without any guarantee of uninterrupted access. We may modify, suspend or
        discontinue features, and will give reasonable notice of material
        changes that adversely affect paid subscribers.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;, without warranties of any kind, whether express or
        implied, including fitness for a particular purpose and
        non-infringement. {SITE_NAME} is not a backup service: you are
        responsible for keeping your own copies of anything you cannot afford to
        lose.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {LEGAL_ENTITY} will not be liable
        for any indirect, incidental, special, consequential or punitive damages,
        or for any loss of profits, data or goodwill. Our total aggregate
        liability arising out of or relating to the Service is limited to the
        greater of the amounts you paid us in the twelve months preceding the
        claim, or USD 100.
      </p>
      <p>
        Nothing in these Terms excludes liability that cannot lawfully be
        excluded, including for death or personal injury caused by negligence,
        or for fraud.
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You agree to indemnify and hold {LEGAL_ENTITY} harmless from claims
        arising out of Your Content or your breach of these Terms or of
        applicable law.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Where a change materially
        affects your rights we will notify account holders by email or in the
        Service before it takes effect. Continued use after that date
        constitutes acceptance.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Terms are governed by the laws of {GOVERNING_LAW}, without regard
        to conflict-of-law rules, and the courts of {GOVERNING_LAW} have
        exclusive jurisdiction — except where mandatory consumer protection law
        in your country of residence gives you the right to bring proceedings
        locally.
      </p>

      <h2>15. Contact</h2>
      <p>Questions about these Terms can be sent to {SUPPORT_EMAIL}.</p>
    </LegalPage>
  );
}
