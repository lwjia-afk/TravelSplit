# TravelSplit

A mobile app for splitting travel expenses among family members and friends. Built with React Native / Expo, supporting Android and iOS.

---

## Features

### Multi-trip Management
- Create multiple trips, each with a custom name, emoji, and currency
- Switch between trips at any time
- Supports 8 currencies: CNY, USD, JPY, EUR, GBP, HKD, KRW, TWD

### Member & Family Management
- Add members with a name and avatar emoji
- Set each member's **part coefficient** (e.g. adults = 1.0, children = 0.5) for proportional splitting
- Group members into **families** for family-based expense splitting
- Set **sponsors**: one member can cover another member's share entirely (e.g. a parent covering a child's costs)

### Expense Recording
Six expense categories:

| Category | Icon | Default Split |
|----------|------|---------------|
| Dining | 🍜 | By part (proportional) |
| Accommodation | 🏨 | Equal |
| Shopping | 🛍 | Equal |
| Other | 📦 | Configurable |
| Car Rental | 🚗 | By family (equal) |
| Fuel | ⛽ | By family (equal) |

Each expense supports:
- **Custom title, amount, date/time, and location**
- **Payer selection**: any member can pay, even if they didn't participate in the expense
- **Participant selection**: choose who shares the cost
- **Split modes**:
  - *By person*: split among individuals, optionally proportional to their part coefficient
  - *By family*: each family unit pays an equal share; members within the same family split equally
- **Gift flag** 🎁: mark an expense as a gift — it is recorded but no repayment is required

### Settlement Calculation
- Calculates the minimum number of transfers needed to settle all debts
- Shows each transfer: who pays, how much, and to whom
- Mark individual transfers as done
- Detects and highlights data errors (e.g. payer no longer exists, no participants selected)

### Summary Screen
- Per-member breakdown: total paid, total owed, and net balance
- Per-family breakdown
- Daily expense summary grouped by date
- Category breakdown per day

### Cloud Sharing (Firebase)
- Generate a 6-character share code for any trip
- Other family members can join the trip using the code
- Real-time sync: changes made on any device are reflected on all others

### Bilingual Interface
- Supports Chinese (中文) and French (Français)
- Language can be toggled from the Members / Settings screen

---

## Project Structure

```
app/
  (tabs)/
    index.tsx       # Expense list & add/edit form
    members.tsx     # Member & family management
    summary.tsx     # Trip summary & balances
    settle.tsx      # Settlement / who pays whom
    projects.tsx    # Trip management & cloud sharing
src/
  types.ts          # TypeScript types & currency helpers
  store.tsx         # Global state (React Context + AsyncStorage)
  calculator.ts     # Expense splitting & settlement algorithm
  firebase.ts       # Firebase Realtime Database integration
  i18n.ts           # Chinese & French translations
  LanguageContext.tsx
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- [Expo Go](https://expo.dev/go) app on your phone (for quick testing)

### Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd TravelSplit

# Install dependencies
npm install

# Start the development server
npx expo start --port 8081
```

Scan the QR code with Expo Go to run the app on your phone.

---

## Build an Installable Package

To install directly on multiple phones without the App Store or Play Store, use **Expo Application Services (EAS)**.

### Step 1 — Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2 — Log in to Expo

```bash
eas login
```

Create a free account at [expo.dev](https://expo.dev) if you don't have one.

### Step 3 — Configure the build

```bash
eas build:configure
```

This generates an `eas.json` file. For local testing, use the `preview` profile which produces a directly installable file (APK on Android, IPA on iOS).

Your `eas.json` should look like this:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false,
        "distribution": "internal"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Step 4 — Build for Android (APK)

```bash
eas build --platform android --profile preview
```

When the build finishes, EAS provides a download link for the `.apk` file. Send it to testers — they open the link on their Android phone and install it directly.

> **Note:** Testers may need to enable *Install from unknown sources* in Android settings.

### Step 5 — Build for iOS (Ad-hoc / Internal)

iOS requires an Apple Developer account ($99/year). If you have one:

```bash
eas build --platform ios --profile preview
```

EAS will guide you through registering test devices. Each tester's device UDID must be registered before building.

Alternatively, share the app via **TestFlight**:

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

### Step 6 — Build for both platforms at once

```bash
eas build --platform all --profile preview
```

---

## Firebase Setup (Optional — for cloud sharing)

If you want to enable the cloud sharing feature:

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Realtime Database**
3. Copy your config into `src/firebase.ts`:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

4. Set Realtime Database rules to allow read/write:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> For production use, restrict these rules to authenticated users.

---

## Tech Stack

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/)
- [Expo Router](https://expo.github.io/router/) — file-based navigation
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) — local persistence
- [Firebase Realtime Database](https://firebase.google.com/products/realtime-database) — cloud sync
- TypeScript throughout
