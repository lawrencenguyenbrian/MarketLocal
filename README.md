# MarketLocal — Mua bán đồ cũ gần bạn

A local second-hand marketplace web app connecting buyers and sellers nearby. Built with Firebase (Auth, Firestore) and vanilla JS.

## Features

- **Browse listings** — filter by category, province, or search keyword
- **Product details** — image gallery, seller info, view count
- **Favorites** — save listings to your wishlist
- **Chat** — real-time messaging between buyer and seller with inbox
- **Account** — manage your profile and listings
- **Post listings** — upload images via Cloudinary, set price/location/condition

## Tech Stack

- **Frontend** — HTML, CSS (Bootstrap 5 + Tabler Icons), Vanilla JS (ES modules)
- **Backend** — Firebase Auth, Firestore (NoSQL), Firebase Hosting
- **Storage** — Cloudinary for image uploads

## Project Structure

```
├── HTML/          # Pages (auth, home, product, post, chat, account)
├── JS/            # Module scripts (one per page)
├── CSS/           # Stylesheets
├── images/        # Static assets
├── firestore.rules
├── cloudinary.env
└── firebase.json
```

## Firestore Collections

- `users` — user profiles (name, email, province)
- `listings` — product ads (title, price, images, status)
- `chats` — conversation threads with `messages` subcollection
- `users/{uid}/favorites` — saved listings

## Getting Started

1. Clone the repo
2. Set up a Firebase project and enable Auth (Email/Google) + Firestore
3. Configure your Cloudinary account for image uploads
4. Update `firebaseConfig` in each JS file with your project keys (or use the existing `marketlocal-e4ab7` project)
5. Deploy `firestore.rules` via Firebase Console or CLI
6. Open any HTML file via a local server (e.g. `npx serve HTML/`)