###  If you want to change or add a domain later:

Changing your domain is instant and seamless (takes about 60 seconds). Your database, projects, and photos will never be affected.

Here is how you do it whenever you want to switch to a new domain (e.g., mybrand.com):

1. In Vercel:
    • Go to Settings → Domains.
    • Type your new domain and click Add.
    • (You can keep the old domain as an automatic redirect to the new one, or simply click the trash icon to remove the old one).
2. In your Domain Registrar (where you bought the domain):
    • Add the simple DNS record shown by Vercel (e.g. A record 76.76.21.21).
3. In Supabase:
    • Go to Authentication → URL Configuration.
    • Change the Site URL to your new domain (https://mybrand.com).
