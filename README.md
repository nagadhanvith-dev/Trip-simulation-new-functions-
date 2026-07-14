# side-channel <sup>[![Version Badge][npm-version-svg]][package-url]</sup>

[![github actions][actions-image]][actions-url]
[![coverage][codecov-image]][codecov-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

[![npm badge][npm-badge-png]][package-url]

Store information about any JS value in a side channel. Uses WeakMap if available.

Warning: in an environment that lacks `WeakMap`, this implementation will leak memory until you `delete` the `key`.

## Getting started

```sh
npm install --save side-channel
```

## Usage/Examples

```js
const assert = require('assert');
const getSideChannel = require('side-channel');

const channel = getSideChannel();

const key = {};
assert.equal(channel.has(key), false);
assert.throws(() => channel.assert(key), TypeError);

channel.set(key, 42);

channel.assert(key); // does not throw
assert.equal(channel.has(key), true);
assert.equal(channel.get(key), 42);

channel.delete(key);
assert.equal(channel.has(key), false);
assert.throws(() => channel.assert(key), TypeError);
```

## Tests

Clone the repo, `npm install`, and run `npm test`

[package-url]: https://npmjs.org/package/side-channel
[npm-version-svg]: https://versionbadg.es/ljharb/side-channel.svg
[deps-svg]: https://david-dm.org/ljharb/side-channel.svg
[deps-url]: https://david-dm.org/ljharb/side-channel
[dev-deps-svg]: https://david-dm.org/ljharb/side-channel/dev-status.svg
[dev-deps-url]: https://david-dm.org/ljharb/side-channel#info=devDependencies
[npm-badge-png]: https://nodei.co/npm/side-channel.png?downloads=true&stars=true
[license-image]: https://img.shields.io/npm/l/side-channel.svg
# ✈️ TripPay Chain — Collaborative Travel Vault & Blockchain Expense Ledger

TripPay Chain is a state-of-the-art Web3-inspired shared travel expense app. Built for modern groups, it combines Splitwise-style collaborative bill dividing, dynamic interactive map itineraries, real-time photo/video shared galleries, and an automated AI receipt scanner, all secured by a cryptographic **Blockchain Ledger** with real-time fraud alerts and a UPI Payment simulator.

---

## 🚀 Key Features

### 1. ⛓️ Cryptographic Blockchain Ledger
- **Verifiable Trail**: Every single event—from member deposits, expense proposals, travel route changes, to gallery uploads—mines a new cryptographically-signed block onto the chain.
- **SHA-256 digests**: Integrity is verified client-side and server-side.
- **Tampering Alerts & Fraud Simulator**: In the sidebar control panel, simulate a security threat by altering a block. The app immediately flags a chain mismatch, breaks the timeline connection, and locks the vault.
- **Emergency Refund Escape-Hatch**: If the ledger is compromised, members can click "Reclaim & Repay Deposit" to return their locked deposit amount back to their UPI bank balance safely.

### 2. 🏛️ UPI Payment & Bank Simulator
- **Realistic Checkout Flow**: Links simulated bank accounts (HDFC, SBI, ICICI, etc.) with your profile.
- **4-6 Digit UPI PIN Overlay**: Simulates authentication via a graphic, randomized numeric keypad overlay.
- **Refunding & Reclaiming**: Automatic settlements returned directly to bank accounts on trip completion or emergency reclaims.

### 3. 🗺️ Collaborative Live Google Map & Itinerary
- **Multiple Tile Layers**: Switch seamlessly between **Google Roadmap** (live streets, places, and labels), **Google Satellite**, and a dark-theme **Dark Cyber Map**.
- **Nominatim-Powered Place Search**: Search for destinations (e.g. "Baga Beach, Goa") and auto-fill place details and coordinates instantly.
- **Interactive Clicking**: Clicking anywhere on the map automatically grabs the latitude/longitude.
- **Itinerary Timeline**: Color-coded map markers (Suggested = Purple, Next = Green, Visited = Gray) connected by a polyline route path.

### 4. 📸 Shared Media Gallery
- **Synchronized Memories**: Drag-and-drop or select pictures and videos clicked during the trip.
- **Muted Hover Video Previews**: Hovering over video files automatically plays a muted loop preview.
- **Download Actions**: Download full-resolution photos or videos in one click.
- **Lightbox Modals**: Glassmorphic fullscreen viewer modal.

### 5. 🤖 AI OCR Bill & UPI QR Scanner
- **Receipt Parsing**: Drag and drop mockup bills to automatically parse merchant names, dates, amounts, and categories.
- **QR Code Scanning**: Scan UPI QR codes to verify merchant signatures and populate expense proposal forms instantly.

### 6. 🎟️ Trip NFT Tickets
- **Generative Art Ticket**: Once a trip is settled, the app automatically generates a custom, dynamic HTML5 canvas SVG/Ticket representing the group's journey (shows dates, destination names, total vault spent, and block hashes) as a digital souvenir!

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (variables, transitions, animations, glassmorphic filters), and Javascript (ES6+, Leaflet.js).
- **Backend**: Node.js (Express server).
- **Storage**: Local JSON database (`db.json`) for persistence.
- **Security**: Node Crypto (SHA-256 verification) and CryptoJS mock digests.

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd "payment app"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   or using the dev script:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:3000` to start planning.

---

## 🚦 Walkthrough Flow

1. **Start Screen**: Create a new trip with a deposit amount (e.g. ₹5,000) or join an existing trip using a code.
2. **Deposit & Unlock**: Link your bank account (e.g. HDFC Bank) and pay the deposit by inputting your UPI PIN (default is `123456` for Rahul, `654321` for Arjun).
3. **Co-plan on Map**: Open the **Trip Map** tab, search for Baga Beach, click "Add to Itinerary", and map out your route.
4. **Propose Expenses**: Upload a bill in the **Bill Scanner** or enter details manually. Members vote to approve the expense from the shared vault.
5. **Post Gallery Memories**: Upload trip pictures and videos.
6. **Settle Up**: Click "Pass 24 Hours" in the simulator to reach the trip end date, settle all balances, and download your **Trip NFT Ticket** souvenir!

[license-url]: LICENSE
[downloads-image]: https://img.shields.io/npm/dm/side-channel.svg
[downloads-url]: https://npm-stat.com/charts.html?package=side-channel
[codecov-image]: https://codecov.io/gh/ljharb/side-channel/branch/main/graphs/badge.svg
[codecov-url]: https://app.codecov.io/gh/ljharb/side-channel/
[actions-image]: https://img.shields.io/github/check-runs/ljharb/side-channel/main
[actions-url]: https://github.com/ljharb/side-channel/actions
