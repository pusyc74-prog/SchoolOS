# Accounts

SchoolOS Settings → **Accounts** → *How this school keeps its books*:

## Full accounting in SchoolOS

The school's accountant works in Desk → **Accounting** (ERPNext): purchase bills, payments,
journal entries, bank reconciliation, payroll from Frappe HR. Fee bills and receipts are already
there automatically. The principal's **Accounts** tab then shows:

- surplus / deficit for the financial year, income vs expenses by month
- cash and bank balances, today's money in and out
- salary cost as a share of income, where the money goes (expense heads), income by head
- bills to pay (overdue, due this week)
- **Waiting for your approval**: draft supplier bills and staff expense claims. *Approve* submits them;
  *Reject* asks for a reason, which is recorded on the document.

Statutory reports (balance sheet, trial balance, ledgers, GST if needed via the India Compliance app)
stay in ERPNext. The school's CA should confirm GST applicability.

## Tally (export fees to Tally)

For schools whose CA keeps Tally. The **Accounts** tab becomes an export screen:

1. Set the ledger names in Settings → Accounts to match Tally exactly (company, cash, bank,
   fee income ledger or one per fee head, students one-per-student or one common ledger).
2. Pick a date range → **Check what will be exported** shows counts, totals and sample vouchers.
3. Download **1. Ledgers** the first time and import in Tally: *Gateway → Import → Masters*.
4. Download **2. Vouchers** and import: *Gateway → Import → Transactions*.
   Each fee bill becomes a **Sales** voucher, each payment a **Receipt** voucher.

Import into a test company the first time and check a few vouchers before using the live company.
An Excel copy is available for the accountant to review.
