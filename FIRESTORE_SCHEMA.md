# Firestore Schema — MarketLocal

This document defines the recommended Firestore collections, document fields, types, and index suggestions for MarketLocal.

## Collections

1) `users` — user profiles
- Document ID: `uid` (Firebase Auth UID)
- Fields:
  - `name`: string
  - `email`: string
  - `province`: string (e.g., "TP. Hồ Chí Minh")
  - `photoURL`: string (optional)
  - `createdAt`: timestamp
  - `lastSeen`: timestamp (optional)
  - `isVerified`: boolean (optional)

Example:
{
  name: "Nguyen Van A",
  email: "a@example.com",
  province: "TP. Hồ Chí Minh",
  createdAt: Timestamp,
  isVerified: false
}

2) `listings` — product ads
- Document ID: auto-generated (e.g., `listingId`)
- Fields:
  - `title`: string
  - `description`: string
  - `price`: number
  - `currency`: string (e.g., "VND")
  - `category`: string (enum: electronics, fashion, furniture, vehicle, books, sports, kids, other)
  - `condition`: string (e.g., "new","like-new","good","fair")
  - `province`: string
  - `city`: string (optional)
  - `images`: array of objects { url: string, public_id: string (Cloudinary), width: number, height: number }
  - `ownerId`: string (uid)
  - `createdAt`: timestamp
  - `updatedAt`: timestamp
  - `status`: string (e.g., "active","sold","removed")
  - `views`: number (optional)

Example:
{
  title: "Laptop Dell XPS 13",
  price: 18500000,
  currency: "VND",
  category: "electronics",
  condition: "like-new",
  province: "TP. Hồ Chí Minh",
  images: [{ url: "https://...", public_id: "..." }],
  ownerId: "UID123",
  createdAt: Timestamp,
  status: "active"
}

3) `chats` — conversation threads (top-level collection)
- Document ID: auto-generated (`chatId`)
- Fields:
  - `participants`: array of uids (2+ participants)
  - `listingId`: string (optional) — link conversation to a listing
  - `lastMessage`: string (optional)
  - `lastUpdated`: timestamp

  Subcollection: `messages` — message documents
  - Message fields:
    - `senderId`: string
    - `text`: string
    - `attachments`: array (optional) of { url, type }
    - `createdAt`: timestamp
    - `readBy`: array of uids (optional)

Example chat doc:
{
  participants: ["UID_buyer","UID_seller"],
  listingId: "listingId123",
  lastMessage: "Quan tâm, còn không?",
  lastUpdated: Timestamp
}

4) `favorites` (option A: subcollection under user)
- Path: `users/{uid}/favorites/{favId}` where `favId` can be `listingId`
- Fields:
  - `listingId`: string
  - `createdAt`: timestamp

Option B (global collection): `favorites` with documents { userId, listingId, createdAt } — choose based on query patterns.

5) `notifications` (optional)
- Per-user subcollection: `users/{uid}/notifications/{notifId}`
- Fields: `type`, `title`, `body`, `relatedId`, `createdAt`, `read`


## Index suggestions
- Query listings by province + category + createdAt:
  - Composite index: `province ASC, category ASC, createdAt DESC`
- Query listings by ownerId + createdAt:
  - Composite index: `ownerId ASC, createdAt DESC`
- If you support price sorting + filters:
  - Composite index: `province ASC, price DESC` or `category ASC, price ASC`


## Security notes (high level)
- Require authentication for write operations (create listing, chat, favorite).
- Listings: only `ownerId` may edit or delete their listing; reads can be public.
- Users: users may read their own profile and write minimal profile fields; avoid storing sensitive data in Firestore.
- Chats: only participants can read/write messages in a chat.

We'll implement concrete Firebase Security Rules in W4.

---
If you want, I can add a JSON/Firestore export example or generate the matching Firestore security rules next. Which do you prefer?
