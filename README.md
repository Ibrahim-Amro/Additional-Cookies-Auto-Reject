# Auto Reject Cookies

A tiny Chrome extension that clicks "reject" on cookie banners for you.

No more hunting for the tiny gray "decline" link buried under a giant blue "accept" button. This just handles it and gets out of your way.

## What it does

- Recognizes the big consent platforms (OneTrust, Cookiebot, Didomi, Quantcast, TrustArc, Usercentrics, and a bunch more) and clicks their actual reject button
- For random/custom banners, it looks for text like "reject," "decline," "necessary only," etc.
- If a site somehow has a banner with no reject option at all, it just hides the thing so it stops blocking the page
- Keeps an eye on the page after load, since a lot of banners show up a few seconds late

## Install it

Chrome doesn't have this in the store, so it's a manual install:

1. Download/clone this repo
2. Go to `chrome://extensions`
3. Flip on **Developer mode** (top right)
4. Click **Load unpacked**, pick this folder
5. Done — it just runs in the background from here

Click the extension icon anytime to see how many banners it's zapped, or to turn it off globally / on the site you're currently on.

## Why

Cookie banners are annoying and most of us click "reject" every single time anyway. This automates the part of the internet nobody enjoys.

## Heads up

It won't catch literally every banner on the internet — there are too many weird custom implementations out there — but it gets the vast majority, and it'll never leave you stuck unable to use a page.

Contributions welcome if you find a site it misses.
