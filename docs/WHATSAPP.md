# WhatsApp alerts (Meta Cloud API, no reseller)

SchoolOS talks to Meta's WhatsApp Cloud API directly, so you pay only Meta's per-message
rate (utility messages in India were about ₹0.115 + GST in 2026; check Meta's current rate
card). There is no reseller markup or monthly platform fee.

Each school should use **its own** Meta Business account and phone number, so messages
come from the school's name and the school pays Meta directly.

## 1. Set up the number (once per school)

1. Create / use the school's **Meta Business** account (business.facebook.com).
2. On developers.facebook.com create an app → add **WhatsApp**.
3. Add the school's phone number (it must not already be on the WhatsApp app) and verify it.
4. Note the **Phone Number ID**.
5. Create a **permanent access token**: Business Settings → System Users → add a system user
   with the WhatsApp app assigned → Generate token with `whatsapp_business_messaging`.

## 2. Create the message templates

In **WhatsApp Manager → Message Templates**, create these as category **Utility**, in each
language you'll use (e.g. English `en`, Marathi `mr`). Names must match SchoolOS Settings.
The number and order of `{{n}}` placeholders must match exactly.

**school_absence_alert**
```
Dear {{1}}, {{2}} was marked absent today ({{3}}). If this is unexpected, please contact the school. – {{4}}
```

**school_circular**
```
Dear {{1}}, a new notice from {{3}}: "{{2}}". Read it here: {{4}}
```

**school_report_card**
```
Dear {{1}}, {{2}}'s report card for {{3}} has been published by {{4}}. View or download it: {{5}}
```

**school_homework** (only if you allow homework on WhatsApp)
```
Dear {{1}}, new homework for {{2}}: "{{3}}", due {{4}}. – {{5}}
```

**school_fee_reminder**
```
Dear {{1}}, a fee of {{3}} is due for {{2}} (due date {{4}}). Pay online or see details: {{6}} – {{5}}
```

Templates usually get approved within minutes to a day.

## 3. Turn it on in SchoolOS

Desk → **SchoolOS Settings**:

1. Tick **Enable WhatsApp**, paste the Phone Number ID and access token.
2. Check **Graph API Version** against Meta's docs (default `v23.0`).
3. Set **Template Language Code** (`en`, `mr`, …).
4. Click **Send Test Alert** with your own number. With **Test Mode** on you'll see "Dry Run";
   turn Test Mode off to actually send.

## Costs to expect (2,000 students)

Only absences and the occasional circular/report card go on WhatsApp. Roughly 2,200
absence alerts + a few circulars a month comes to under ₹1,000/month in Meta charges.
Every message is listed in **SchoolOS Alert Log**, so you can bill it back to the school.

## Consent

Each Guardian has **Receive School Alerts** (ticked by default) and **Alert Consent Date**.
Untick it for parents who opt out; they won't receive WhatsApp or email alerts.
Collect consent at admission time (India's DPDP Act requires verifiable parental consent
for children's data).
