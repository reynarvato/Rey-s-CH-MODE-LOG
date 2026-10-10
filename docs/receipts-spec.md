# Spend tab: receipt logging (planned, not built)

Status: agreed 10 Oct 2026, to build after a few weeks of using the work log.

## Decisions
- **Capture** in the app: new **Spend** tab → "Add receipt" (camera or screenshot; online orders and e-receipts too). Saved on the phone, works offline. A receipt can optionally be linked to a session.
- **Extraction** in a **GitHub Action in the private data repo** (`Rey-s-CH-MODE-DATA`), not on the phone. The API key lives only as a repo secret (`ANTHROPIC_API_KEY`).
- **Model:** Claude Haiku 5.5. Retry on Claude Sonnet 5.5 only when the total check fails.
- **Total check:** sum(line totals) − discounts must equal the printed total within 1p. On a mismatch after the Sonnet retry, mark the receipt `needs_review`; the app shows a flag on it.
- **Categories:** household set below, split by aisle for groceries, by food type for eating out, by mode for transport.

## Flow
1. The phone syncs the image to `data/receipts/inbox/<id>.jpg` plus a stub in `data/receipts.json` (`status: "pending"`).
2. On push to `data/receipts/inbox/**` (plus a nightly schedule as backup), the Action runs `scripts/extract.py`:
   - sends the image to Haiku with the schema + category list (structured output / tool use)
   - runs the total check, retries on Sonnet if it fails
   - applies `data/receipts/corrections.json` (the user's past fixes: raw text → clean name/category)
   - writes the receipt + items into `data/receipts.json`, regenerates `data/items.csv`, moves the image to `data/receipts/images/`
   - commits as "Extract receipt <shop> <date>"
3. The phone pulls on its next sync. The Spend tab shows the receipt and items; the user can fix a name or category, and fixes are written to `corrections.json` so they stick for that product.
4. Merge rules follow `log.json`: per-record `updatedAt`, newest wins, deletes kept as tombstones.

## Data
**Receipt:** id, date, time, shop, shop_branch, total, discounts_total, loyalty_savings (Clubcard / Nectar), payment_method, currency (GBP), image, status (pending | done | needs_review), model_used, session_id (optional), updatedAt.

**Item (one row per line):** receipt_id, raw_text (e.g. "TSCO SEMI SKM 2PT"), name (clean, e.g. "Semi-skimmed milk"), brand, own_label (bool), qty, size_value, size_unit (g, kg, ml, l, each), unit_price, line_total, discount, price_per_kg_or_l, category, subcategory, habit_tag, health_tag, updatedAt.

- habit_tag examples: meal deal, coffee, gym snack, lunch out, takeaway, late-night
- health_tag: whole food | minimally processed | processed | ultra-processed | treat | n/a (non-food)

## Categories (category → subcategories)
- **Groceries** → fruit & veg · meat & fish · dairy & eggs · bakery · cupboard (tins, pasta, rice, sauces) · frozen · snacks & sweets · drinks (soft) · alcohol · household & cleaning · toiletries & personal care · baby & pet · other
- **Eating out** → coffee & tea · breakfast · lunch / meal deal · dinner (restaurant) · takeaway & delivery · fast food · bakery & snacks · drinks & bar · dessert
- **Transport** → train · bus & tram · taxi & ride-hail · fuel · parking · flights · car costs (insurance, MOT, repairs) · bike & scooter
- **Subscriptions** → software & AI tools · streaming & media · phone & internet · cloud storage · news & learning · other
- **Health** → pharmacy & medicine · supplements · appointments · glasses & dental
- **Fitness** → gym membership · classes · kit & clothing · sports nutrition
- **Home** → rent & bills · furniture & homeware · tools & DIY · electronics
- **Shopping** → clothing & shoes · books · gifts · hobbies & games · tech & components
- **Learning** → courses · language lessons · books & materials · conferences
- **Travel** → accommodation · activities · travel insurance
- **Personal** → haircut & grooming · laundry · other
- **Fees & other** → bank fees · postage · uncategorised

## Spend tab views
- This month vs last: total by category (Excel colour scale, same as the work log)
- Top recurring items, with a price history per item and price per kg/l by shop
- Habits per week: meal deals, coffees, takeaways, with £ per week
- Healthy share of food spend (by health_tag)
- Receipts list with a needs-review flag; tap to see image + items

## Later (not in the app)
A monthly review with Claude, run in chat or as a scheduled task, that reads `items.csv` and suggests cheaper or healthier swaps, checking live prices on the web.

## Setup the user will need
- An Anthropic API key (console.anthropic.com, billed separately from a Claude subscription) added as the `ANTHROPIC_API_KEY` secret in the data repo
- Actions enabled on the data repo (private repos use the free Actions minutes; this job takes seconds per receipt)
