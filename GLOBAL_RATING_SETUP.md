# Global rating setup

The game uses a Supabase Edge Function so scores can be shared across Telegram users. The function verifies Telegram `initData`; the bot token and Supabase service-role key stay on the server.

1. Create a Supabase project.
2. Install the Supabase CLI, run `supabase login`, then link the project:
   `supabase link --project-ref YOUR_PROJECT_REF`
3. Apply the database migration:
   `supabase db push`
4. In Supabase project settings, add the Edge Function secret `TELEGRAM_BOT_TOKEN` using the token from BotFather. Do not put this token in `game.js`, `index.html`, or GitHub.
5. Deploy the public function endpoint:
   `supabase functions deploy global-rating --no-verify-jwt`
6. In `index.html`, set the `global-rating-endpoint` meta tag to:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/global-rating`
7. Publish the updated Telegram branch through GitHub Pages and open the Mini App from Telegram.

Leaderboard reads are public. Score submissions and display-name changes require valid, recent Telegram `initData`. Each Telegram user has one best score per location. Scores are still computed by the browser, so this provides a shared casual leaderboard, not cheat-proof competitive scoring.
