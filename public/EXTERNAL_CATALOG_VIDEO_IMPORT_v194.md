# OrzuMall v194 — external catalog video import

- Sahiy, Uzum, 1688 and Pinduoduo extractors collect openly exposed video URLs.
- Admin can verify or manually enter a video URL and poster image.
- Videos are stored as source URLs instead of being copied to Firebase Storage.
- Product pages show the Video action only when a video URL exists.
- Direct MP4/WebM videos use the native HTML5 player; YouTube-like URLs use the existing embedded viewer.
