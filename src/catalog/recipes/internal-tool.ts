import type { Recipe } from "../types";

const V = "2026-11-07";

export const internalTool: Recipe = {
  slug: "internal-tool",
  title: "Staff tool on a no-code builder",
  summary:
    "A small app for your own team (inventory counts, orders, checklists, schedules) built on a no-code builder over a spreadsheet or database, instead of custom code. AppSheet when the business runs on Google Workspace, Retool when the data is already in a database or API.",
  matches: [
    "internal tool", "internal app", "staff app", "for my staff", "for our staff", "back office", "back-office",
    "admin panel", "inventory", "timesheets", "shift schedule", "appsheet", "retool", "no-code", "nocode",
  ],
  fitsWhen: [
    "The users are your own staff, usually under a few dozen people.",
    "The job is forms, lists, counts and approvals over shared data.",
    "Nobody on the team wants to host, patch and fix custom code.",
  ],
  notFor: [
    "Tools your customers will use or pay for: that's a product. See the b2b-saas or marketplace recipes.",
    "Logic the builder can't express, such as heavy calculations, complex integrations or strict audit requirements: build custom on Postgres.",
    "Data that must not sit in a spreadsheet, such as health or payment records: use a database with access controls and get advice first.",
  ],
  stack: [
    {
      category: "internal_tools",
      tool: "appsheet",
      why: "AppSheet Core is included in most paid Google Workspace plans, it builds an app straight from Google Sheets, staff sign in with the Workspace accounts they already have, and paid plans run offline with background sync.",
      alternatives: [
        { tool: "retool", when: "The data lives in a database or API, or you need more custom screens; free up to 5 users, then $10 per builder and $5 per staff user a month, billed annually." },
        { tool: "airtable", when: "The team wants a shared database they edit directly more than an app." },
        { tool: "glide", when: "You want the most polished phone layout and the data is small." },
      ],
    },
  ],
  steps: [
    {
      title: "Decide builder or custom code",
      detail: "For a small staff tool, a builder usually wins: there's nothing to host, patch or debug at 6 a.m. before opening.",
      actions: [
        "Write down the three to five jobs the tool must do (for example: log today's counts, see low stock, enter a wholesale order, mark it delivered).",
        "For each job, note who does it, on what device, and whether there's Wi-Fi where they do it.",
        "Pick a builder if every job is a form, a list, a filter or a simple calculation. Build custom only if a job needs logic or integrations the builder can't do.",
        "Pick AppSheet if the business already uses paid Google Workspace; pick Retool if the data is already in a database or the tool must call your other systems' APIs.",
      ],
      check: "You have a one-page list of jobs, users and devices, and a written reason for the builder you chose.",
    },
    {
      title: "Check your Workspace plan and turn on AppSheet",
      detail: "AppSheet Core is included in most paid Google Workspace editions, so check before paying for anything.",
      actions: [
        "In the Google Admin console, check your edition under Billing. Google's admin help lists the editions that include AppSheet Core, including Business Starter, Business Standard and Business Plus.",
        "Turn AppSheet on for your organization (or for the staff group only) in the Admin console's additional Google services.",
        "If your edition doesn't include Core, prototype for free (up to 10 test users) and buy Starter ($5) or Core ($10) per user a month only when you go live.",
        "Make the app's owner a shared business account, not one person's account, so the app survives someone leaving.",
      ],
      check: "A staff account can open appsheet.com and create an app without a payment prompt.",
      docs: ["https://about.appsheet.com/pricing/", "https://support.google.com/a/answer/10100275"],
    },
    {
      title: "Lay out the data in Google Sheets",
      detail: "Each sheet is a table, each row is a record, and each record has a unique id. Getting this right matters more than any screen.",
      actions: [
        "Create one spreadsheet with a tab per table: Items, Counts, Customers, Orders, Order Lines and Staff.",
        "Give every tab an ID column; let AppSheet generate ids with UNIQUEID().",
        "Link tables by id columns (an Order Line has an Order ID and an Item ID), never by names that can change.",
        "Put one header row at the top of each tab and no merged cells, totals or notes in the data area.",
        "Add a Staff tab with each person's Workspace email and role (staff or manager).",
      ],
      files: [
        {
          path: "sheets/layout.csv",
          contents:
            "tab,columns\nItems,ID | Name | Unit | Par level | Active\nCounts,ID | Item ID | Date | Quantity | Counted by\nCustomers,ID | Name | Contact email | Delivery notes\nOrders,ID | Customer ID | Delivery date | Status | Created by\nOrder Lines,ID | Order ID | Item ID | Quantity\nStaff,Email | Name | Role\n",
        },
      ],
      check: "Every tab has a header row, an ID column, and links to other tabs by id.",
    },
    {
      title: "Generate the app and set column types",
      detail: "AppSheet builds a first version from the sheet; you then fix the types so forms and links work.",
      actions: [
        "Create the app from the spreadsheet in AppSheet and add every tab as a table.",
        "Set types: Ref for id links (Item ID refers to Items), Date, Number, Enum for Status, Email for emails.",
        "Mark the ID column as the key and the Name column as the label in each table.",
        "Build the views staff need: a form for today's count, a list of low-stock items (count below par), and an order form with order lines inline.",
        "Remove the views staff don't need; fewer buttons means fewer mistakes.",
      ],
      check: "A staff member can enter today's count for every item and an order with three lines, without help.",
      docs: ["https://support.google.com/appsheet/table/10104782"],
    },
    {
      title: "Control who sees and changes what",
      detail: "Staff should edit today's work; managers change items, prices and customers.",
      actions: [
        "Require sign-in and limit the app to your Workspace domain.",
        "Look up the signed-in user's role from the Staff tab, and use it to hide manager-only views and actions.",
        "Use security filters so staff see only what they need, for example orders for this week.",
        "Make edits to Items and Customers manager-only.",
      ],
      check: "A staff account can't edit item par levels or see the manager views; a manager account can.",
      docs: ["https://support.google.com/appsheet/answer/10104488"],
    },
    {
      title: "Make it work on the floor, offline",
      detail: "Back rooms and walk-in fridges often have no signal. Paid AppSheet plans run apps offline and sync in the background.",
      actions: [
        "Install the AppSheet app on the shop's phones or tablets and sign in with Workspace accounts.",
        "Check the app's sync settings (Delayed Sync and Sync on Start) so work entered offline is kept and sent on reconnect, and test with the device in airplane mode.",
        "Test what happens when two people edit the same order offline, and decide who wins (usually: one person owns each order).",
        "Keep images small and the data tabs trimmed so the first sync on a new device is quick.",
      ],
      check: "A count entered in airplane mode appears in the sheet within a minute of reconnecting.",
      docs: ["https://support.google.com/appsheet/answer/10108301", "https://about.appsheet.com/pricing/"],
    },
    {
      title: "Automate the reminders",
      detail: "The tool earns its keep when it tells people things: low stock, tomorrow's deliveries, a missed count.",
      actions: [
        "Add an automation that emails or notifies the manager when an item's latest count is below its par level.",
        "Add a daily summary of tomorrow's wholesale orders for whoever bakes or packs them.",
        "Send to a shared address or group, so the alert doesn't depend on one person.",
      ],
      check: "Setting a test item's count below par sends one alert to the right people.",
      docs: ["https://support.google.com/appsheet/"],
    },
    {
      title: "Roll out and keep it healthy",
      detail: "Train in ten minutes, watch the first week, and plan for the day it outgrows a spreadsheet.",
      actions: [
        "Show each person the two or three screens they use, on their own device.",
        "Check the sheet daily in the first week for blanks, duplicates and wrong items, and fix the form that let them in.",
        "Use the spreadsheet's version history as your backup, and export a copy monthly.",
        "If the sheet gets slow or you need stricter permissions, move the data to a database, and check which database connectors your builder's plan includes.",
      ],
      check: "After a week, every count and order is in the app, and nobody keeps a paper backup.",
    },
  ],
  bestPractices: [
    "Start from the jobs and the devices, not from the screens.",
    "Use ids to link records; names change and break links.",
    "Own the app and the sheet with a shared business account.",
    "Give each record one owner to avoid offline edit conflicts.",
    "Keep the first version to three to five screens and add more only when someone asks.",
    "Check your Workspace plan before buying a builder; you may already have AppSheet Core.",
  ],
  pitfalls: [
    "Building and hosting a custom app for a ten-person team that then nobody can maintain.",
    "Merged cells, totals rows or notes inside the data tabs, which break the app's tables.",
    "Linking orders to items by name, then renaming an item.",
    "Building the app in one person's personal account.",
    "Rolling out without testing offline in the place staff actually work.",
  ],
  complianceNotes: [
    "If the tool stores staff personal data (phone numbers, hours, pay), keep it to what the job needs and restrict it to managers.",
    "Food businesses may have record-keeping rules (temperatures, allergens, lot tracking) where you operate; check what must be kept and for how long before relying on the app as the record.",
    "Data in Google Workspace is covered by your Workspace terms and admin settings; check them if customers or regulators ask where records are kept.",
  ],
  catches: [
    {
      text: "AppSheet Core is included in most paid Google Workspace plans; Google's admin help lists the editions, including Business Starter, Standard and Plus. Otherwise Starter is $5 and Core $10 per user a month, and you can prototype free with up to 10 test users.",
      source: "https://about.appsheet.com/pricing/",
      verifiedOn: V,
    },
    {
      text: "AppSheet's paid plans list 'Run apps offline with background sync', which matters for back rooms and fridges with no signal.",
      source: "https://about.appsheet.com/pricing/",
      verifiedOn: V,
    },
    {
      text: "Retool is free up to 5 users; Team is $10 per builder and $5 per staff user a month, billed annually.",
      source: "https://retool.com/pricing",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "For 10 staff: $0 if your Workspace edition includes AppSheet Core; otherwise AppSheet Starter at $5 × 10 = $50 a month, or Core at $10 × 10 = $100.",
    "Retool instead: 1 builder at $10 + 9 staff at $5 = $55 a month, billed annually.",
    "A custom app instead: hosting and database can be free at this size, but the real cost is the hours to build and maintain it.",
  ],
  verifiedOn: V,
};
