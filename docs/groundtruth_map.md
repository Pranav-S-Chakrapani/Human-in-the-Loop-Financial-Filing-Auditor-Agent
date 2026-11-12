# Ground Truth Concept Map (`groundtruth_map.md`)

This document maps each of the 8 target financial metrics to its authoritative `us-gaap` concept in SEC Company Facts for each company's pinned accession and fiscal year end.

---

## Metric Concepts Key
- **revenue**: `RevenueFromContractWithCustomerExcludingAssessedTax` or `Revenues` or `SalesRevenueNet`
- **net_income**: `NetIncomeLoss` (attributable to parent)
- **total_assets**: `Assets`
- **total_liabilities**: `Liabilities`
- **shareholders_equity**: `StockholdersEquity` (or `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest` where unsegregated)
- **operating_cash_flow**: `NetCashProvidedByUsedInOperatingActivities`
- **gross_profit**: `GrossProfit`
- **diluted_eps**: `EarningsPerShareDiluted`

---

## 1. Company Mapping Tables

### AAPL (Apple Inc.)
- **CIK**: `0000320193` | **Accession**: `0000320193-26-000026` | **Fiscal Year End**: `2026-09-26`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2026) | Period (Start / End) | Prior Year Value (FY 2025) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `RevenueFromContractWithCustomerExcludingAssessedTax` | USD | \$478,834,000,000 | 2025-09-28 to 2026-09-26 | \$416,161,000,000 | Clean annual duration |
| **net_income** | `NetIncomeLoss` | USD | \$132,175,000,000 | 2025-09-28 to 2026-09-26 | \$112,010,000,000 | Clean |
| **total_assets** | `Assets` | USD | \$404,548,000,000 | End: 2026-09-26 | \$359,241,000,000 | Instantaneous |
| **total_liabilities** | `Liabilities` | USD | \$292,455,000,000 | End: 2026-09-26 | \$285,508,000,000 | Instantaneous |
| **shareholders_equity** | `StockholdersEquity` | USD | \$112,093,000,000 | End: 2026-09-26 | \$73,733,000,000 | Instantaneous |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$145,097,000,000 | 2025-09-28 to 2026-09-26 | \$111,482,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$233,602,000,000 | 2025-09-28 to 2026-09-26 | \$195,201,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$8.98 | 2025-09-28 to 2026-09-26 | \$7.46 | Clean |

---

### MSFT (MICROSOFT CORP)
- **CIK**: `0000789019` | **Accession**: `0001193125-26-323660` | **Fiscal Year End**: `2026-06-30`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2026) | Period (Start / End) | Prior Year Value (FY 2025) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `RevenueFromContractWithCustomerExcludingAssessedTax` | USD | \$331,839,000,000 | 2025-07-01 to 2026-06-30 | \$281,724,000,000 | Clean |
| **net_income** | `NetIncomeLoss` | USD | \$133,749,000,000 | 2025-07-01 to 2026-06-30 | \$101,832,000,000 | Clean |
| **total_assets** | `Assets` | USD | \$758,376,000,000 | End: 2026-06-30 | \$619,003,000,000 | Instantaneous |
| **total_liabilities** | `Liabilities` | USD | \$315,989,000,000 | End: 2026-06-30 | \$275,524,000,000 | Instantaneous |
| **shareholders_equity** | `StockholdersEquity` | USD | \$442,387,000,000 | End: 2026-06-30 | \$343,479,000,000 | Instantaneous |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$182,935,000,000 | 2025-07-01 to 2026-06-30 | \$136,162,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$225,465,000,000 | 2025-07-01 to 2026-06-30 | \$193,893,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$17.95 | 2025-07-01 to 2026-06-30 | \$13.64 | Clean |

---

### NKE (NIKE, Inc.)
- **CIK**: `0000320187` | **Accession**: `0000320187-26-000088` | **Fiscal Year End**: `2026-05-31`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2026) | Period (Start / End) | Prior Year Value (FY 2025) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `RevenueFromContractWithCustomerExcludingAssessedTax` | USD | \$46,398,000,000 | 2025-06-01 to 2026-05-31 | \$46,309,000,000 | Wholesale/direct revenue breakdown in footnotes |
| **net_income** | `NetIncomeLoss` | USD | \$3,108,000,000 | 2025-06-01 to 2026-05-31 | \$3,219,000,000 | Clean |
| **total_assets** | `Assets` | USD | \$38,410,000,000 | End: 2026-05-31 | \$36,579,000,000 | Instantaneous |
| **total_liabilities** | *None* | - | *Not Reported in XBRL* | - | *Not Reported* | **FLAG:** NKE tags `LiabilitiesCurrent` and noncurrent items, but does not tag total `Liabilities` concept. |
| **shareholders_equity** | `StockholdersEquity` | USD | \$14,865,000,000 | End: 2026-05-31 | \$13,213,000,000 | Instantaneous |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$2,868,000,000 | 2025-06-01 to 2026-05-31 | \$3,698,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$19,911,000,000 | 2025-06-01 to 2026-05-31 | \$19,790,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$2.10 | 2025-06-01 to 2026-05-31 | \$2.16 | Clean |

---

### PEP (PEPSICO INC)
- **CIK**: `0000077476` | **Accession**: `0000077476-26-000007` | **Fiscal Year End**: `2025-12-27`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2025) | Period (Start / End) | Prior Year Value (FY 2024) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `Revenues` | USD | \$93,925,000,000 | 2024-12-29 to 2025-12-27 | \$91,854,000,000 | Clean |
| **net_income** | `NetIncomeLoss` | USD | \$8,240,000,000 | 2024-12-29 to 2025-12-27 | \$9,578,000,000 | Parent-specific net income (excludes \$55M NCI) |
| **total_assets** | `Assets` | USD | \$107,399,000,000 | End: 2025-12-27 | \$99,467,000,000 | Instantaneous |
| **total_liabilities** | `Liabilities` | USD | \$86,852,000,000 | End: 2025-12-27 | \$80,564,000,000 | Instantaneous |
| **shareholders_equity** | `StockholdersEquity` | USD | \$20,381,000,000 | End: 2025-12-27 | \$18,740,000,000 | Parent stockholders' equity |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$12,087,000,000 | 2024-12-29 to 2025-12-27 | \$12,507,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$50,859,000,000 | 2024-12-29 to 2025-12-27 | \$50,110,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$6.00 | 2024-12-29 to 2025-12-27 | \$6.95 | Clean |

---

### JNJ (JOHNSON & JOHNSON)
- **CIK**: `0000200406` | **Accession**: `0000200406-26-000016` | **Fiscal Year End**: `2025-12-28`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2025) | Period (Start / End) | Prior Year Value (FY 2024) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `SalesRevenueNet` | USD | \$94,193,000,000 | 2024-12-30 to 2025-12-28 | \$88,821,000,000 | Labeled `Sales to customers` |
| **net_income** | `NetIncomeLoss` | USD | \$26,804,000,000 | 2024-12-30 to 2025-12-28 | \$14,066,000,000 | Labeled `Net earnings` |
| **total_assets** | `Assets` | USD | \$199,210,000,000 | End: 2025-12-28 | \$180,104,000,000 | Instantaneous |
| **total_liabilities** | `Liabilities` | USD | \$117,666,000,000 | End: 2025-12-28 | \$108,614,000,000 | Instantaneous |
| **shareholders_equity** | `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest` | USD | \$81,544,000,000 | End: 2025-12-28 | \$71,490,000,000 | JNJ reports single combined equity line |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$24,530,000,000 | 2024-12-30 to 2025-12-28 | \$24,266,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$63,937,000,000 | 2024-12-30 to 2025-12-28 | \$61,350,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$11.03 | 2024-12-30 to 2025-12-28 | \$5.79 | Clean |

---

### KO (COCA COLA CO)
- **CIK**: `0000021344` | **Accession**: `0001628280-26-010047` | **Fiscal Year End**: `2025-12-31`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2025) | Period (Start / End) | Prior Year Value (FY 2024) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `Revenues` | USD | \$47,941,000,000 | 2025-01-01 to 2025-12-31 | \$47,061,000,000 | Clean |
| **net_income** | `NetIncomeLoss` | USD | \$13,107,000,000 | 2025-01-01 to 2025-12-31 | \$10,631,000,000 | Parent shareowners' net income |
| **total_assets** | `Assets` | USD | \$104,816,000,000 | End: 2025-12-31 | \$100,549,000,000 | Instantaneous |
| **total_liabilities** | *None* | - | *Not Reported in XBRL* | - | *Not Reported* | **FLAG:** No `Liabilities` concept tagged; KO omits total liabilities line (SPEC §9 derived) |
| **shareholders_equity** | `StockholdersEquity` | USD | \$32,169,000,000 | End: 2025-12-31 | \$24,856,000,000 | Parent equity (excludes \$2,106M NCI) |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$7,408,000,000 | 2025-01-01 to 2025-12-31 | \$6,805,000,000 | Clean |
| **gross_profit** | `GrossProfit` | USD | \$29,544,000,000 | 2025-01-01 to 2025-12-31 | \$28,737,000,000 | Clean |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$3.04 | 2025-01-01 to 2025-12-31 | \$2.46 | Clean |

---

### AMZN (AMAZON COM INC)
- **CIK**: `0001018724` | **Accession**: `0001018724-26-000004` | **Fiscal Year End**: `2025-12-31`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2025) | Period (Start / End) | Prior Year Value (FY 2024) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `RevenueFromContractWithCustomerExcludingAssessedTax` | USD | \$716,924,000,000 | 2025-01-01 to 2025-12-31 | \$637,959,000,000 | Sum of products + services |
| **net_income** | `NetIncomeLoss` | USD | \$77,670,000,000 | 2025-01-01 to 2025-12-31 | \$59,248,000,000 | Clean |
| **total_assets** | `Assets` | USD | \$818,042,000,000 | End: 2025-12-31 | \$624,894,000,000 | Instantaneous |
| **total_liabilities** | *None* | - | *Not Reported in XBRL* | - | *Not Reported* | **FLAG:** No `Liabilities` concept tagged; AMZN omits total liabilities line (SPEC §9 derived) |
| **shareholders_equity** | `StockholdersEquity` | USD | \$411,065,000,000 | End: 2025-12-31 | \$285,970,000,000 | Instantaneous |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$139,514,000,000 | 2025-01-01 to 2025-12-31 | \$115,877,000,000 | Clean |
| **gross_profit** | *None* | - | *Not Reported in XBRL* | - | *Not Reported* | **FLAG:** AMZN does not tabulate Gross Profit on Income Statement or in XBRL facts |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$7.17 | 2025-01-01 to 2025-12-31 | \$5.53 | Clean |

---

### GOOGL (Alphabet Inc.)
- **CIK**: `0001652044` | **Accession**: `0001652044-26-000018` | **Fiscal Year End**: `2025-12-31`

| Metric | US-GAAP Concept | Unit | Current Value (FY 2025) | Period (Start / End) | Prior Year Value (FY 2024) | Flags / Traps |
|---|---|:---:|:---:|:---:|:---:|---|
| **revenue** | `Revenues` | USD | \$402,836,000,000 | 2025-01-01 to 2025-12-31 | \$350,018,000,000 | Clean |
| **net_income** | `NetIncomeLoss` | USD | \$132,170,000,000 | 2025-01-01 to 2025-12-31 | \$100,118,000,000 | Clean |
| **total_assets** | `Assets` | USD | \$595,281,000,000 | End: 2025-12-31 | \$450,256,000,000 | Instantaneous |
| **total_liabilities** | `Liabilities` | USD | \$180,016,000,000 | End: 2025-12-31 | \$125,172,000,000 | Instantaneous |
| **shareholders_equity** | `StockholdersEquity` | USD | \$415,265,000,000 | End: 2025-12-31 | \$325,084,000,000 | Instantaneous |
| **operating_cash_flow** | `NetCashProvidedByUsedInOperatingActivities` | USD | \$164,713,000,000 | 2025-01-01 to 2025-12-31 | \$125,299,000,000 | Clean |
| **gross_profit** | *None* | - | *Not Reported in XBRL* | - | *Not Reported* | **FLAG:** Alphabet does not report Gross Profit (SPEC §9 not_reported) |
| **diluted_eps** | `EarningsPerShareDiluted` | USD/shares | \$10.81 | 2025-01-01 to 2025-12-31 | \$8.04 | Clean |

---

## 2. Identified Traps and Edge Cases for Verification

1. **Missing `Liabilities` Concept (KO, AMZN, NKE)**:
   - KO and AMZN do not report a Total Liabilities subtotal on their balance sheets, so no `us-gaap:Liabilities` concept is tagged in XBRL. Ground truth verification must accept the derived equation ($Assets - Equity$) or evaluate component liabilities.
   - NKE reports a visual line in the HTML table for "Total liabilities", but tags only current and non-current sub-components in XBRL without a root `Liabilities` concept.
2. **Missing `GrossProfit` Concept (GOOGL, AMZN)**:
   - Neither Alphabet nor Amazon reports Gross Profit on the face of their income statement or tags it in XBRL. Both correctly map to `not_reported`.
3. **Revenue Concept Variation**:
   - Modern filings alternate between `RevenueFromContractWithCustomerExcludingAssessedTax` (AAPL, MSFT, NKE, AMZN) and standard `Revenues` (PEP, KO, GOOGL) or `SalesRevenueNet` (JNJ). Ground truth resolution must support this candidate set.
4. **Duplicate Facts across Accessions & Restatements**:
   - Company Facts records multiple historical restatements for prior years across different 10-K and 10-Q accessions. Filtering strictly by `accn == pinned_accession` and `form == "10-K"` eliminates restatement noise and guarantees comparative consistency.
5. **Duration Spans vs Quarterly Spans**:
   - Company Facts includes both 3-month (Q4) and 12-month (FY) entries with the same `end` date. Ground truth verification must filter by `fp == 'FY'` or duration $> 350$ days.
