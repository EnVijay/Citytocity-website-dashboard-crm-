# CRM Dashboard (Airtable Backend)

A lightweight CRM dashboard that includes:
- Email/password login
- User dashboard view after login
- Add or update CRM details using a form
- Airtable as the backend datastore

## Airtable schema
Create a base with two tables:

### 1) `Users`
Required fields:
- `Email` (single line text)
- `Password` (single line text)
- `Name` (single line text, optional)

### 2) `Details`
Required fields:
- `Email` (single line text)
- `Company` (single line text)
- `Phone` (single line text)
- `Notes` (long text)

## Setup
1. (Optional) Run install to generate lock file:
   ```bash
   npm install
   ```

2. Set environment variables and start:
   ```bash
   AIRTABLE_TOKEN=patxxxxxxxxxxxx \
   AIRTABLE_BASE_ID=appxxxxxxxxxxxx \
   AIRTABLE_USERS_TABLE=Users \
   AIRTABLE_DETAILS_TABLE=Details \
   PORT=3000 \
   npm start
   ```

3. Open:
   `http://localhost:3000`

## Notes
- Login validates `Email` + `Password` from the `Users` table.
- Details are upserted (update existing record by email, otherwise create new).
- This demo keeps login state in localStorage and does not include JWT/session auth.
