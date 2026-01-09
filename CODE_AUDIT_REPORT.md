# Code Audit Report - Duplicate, Redundant & Unused Code

**Date:** 9 January 2026  
**Audited by:** GitHub Copilot  
**Severity Levels:** 🔴 Critical | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL ISSUES

### 1. **DUPLICATE FUNCTION: `escapeHtml`** (4 instances)
**Locations:**
- `/app/contracts/[id]/page.tsx:57`
- `/app/contracts/[id]/IndexingNoticePrint.tsx:29`
- `/app/contracts/written-contract/written-contract-form.tsx:265`
- `/lib/indexing-notice-html.ts:5`

**Impact:** Code maintenance nightmare, inconsistent behavior risk  
**Solution:** Create single utility in `/lib/utils/html.ts`

### 2. **DUPLICATE FUNCTION: `normalizeIsoDate`** (3 instances)
**Locations:**
- `/app/contracts/[id]/page.tsx:77`
- `/app/contracts/[id]/manage/actions.ts:20`
- `/lib/exchange.ts:76`

**Impact:** Same logic repeated 3 times  
**Solution:** Create single utility in `/lib/utils/date.ts`

### 3. **UNUSED NOTIFICATION FUNCTIONS**
**Location:** `/lib/notify-delivery.ts`
**Functions:**
- `deliverSlack()` - Only called from `deliverAllChannels()`
- `deliverSms()` - Only called from `deliverAllChannels()`
- `deliverSignal()` - Only called from `deliverAllChannels()`
- `deliverEmail()` - NEVER USED ANYWHERE

**Impact:** Dead code, confusing API surface  
**Solution:** Remove `deliverEmail()` completely, make others private

### 4. **DEPRECATED MODULE KEPT AS STUB**
**Location:** `/lib/exchange-rai.ts`
**Function:** `getDailyRaiEurSell()`

**Impact:** Throws error if called, serves no purpose  
**Solution:** DELETE ENTIRE FILE - no imports found except the function itself

---

## 🟡 MEDIUM ISSUES

### 5. **RE-EXPORT SHIM: `/lib/invoices.ts`**
**Status:** Entire file just re-exports from `/lib/contracts.ts`  
**Current usage:**
- Only 3 files import from it
- All functions actually live in contracts.ts

**Impact:** Indirection layer adds confusion  
**Solution:** Update imports to use `/lib/contracts` directly, DELETE `/lib/invoices.ts`

### 6. **UNUSED EXPORT: `deliverEmail()`**
**Location:** `/lib/notify-delivery.ts:8`  
**Exported but NEVER imported or used**

**Solution:** Remove export

### 7. **LARGE MOCK DATA IN PRODUCTION CODE**
**Location:** `/lib/contracts.ts:17-230`  
**Function:** `getMockContracts()`  
**Lines:** 214 lines of mock data hardcoded

**Impact:** Increases bundle size, only used in seed script  
**Solution:** Move to `/scripts/seed-data.ts`

---

## 🟢 LOW PRIORITY

### 8. **DUPLICATE HELPER: `toEmailHtmlParagraphs`**
**Location:** Only in `/app/contracts/[id]/page.tsx:66`  
**Used:** Only in that file for email formatting

**Impact:** Low - localized use  
**Recommendation:** Keep as-is OR move to email utils if reused

### 9. **MULTIPLE HELPER FUNCTIONS IN PAGE FILES**
**Locations:**
- `/app/contracts/[id]/page.tsx` has 5+ helper functions
- Functions like `latestWrittenContractEnd`, `resolveEndDateWithWritten`, `fmt`

**Impact:** Makes 4732-line file harder to maintain  
**Recommendation:** Extract to `/app/contracts/[id]/utils.ts`

---

## ACTIONABLE PLAN

### Phase 1: Critical Removals (DO NOW) 🔴
```bash
1. DELETE /lib/exchange-rai.ts (entire file)
2. DELETE deliverEmail() from /lib/notify-delivery.ts
3. CREATE /lib/utils/html.ts with single escapeHtml()
4. CREATE /lib/utils/date.ts with single normalizeIsoDate()
5. UPDATE all 7 locations to import from new utils
```

### Phase 2: Code Consolidation 🟡
```bash
6. DELETE /lib/invoices.ts
7. UPDATE 3 import statements to use /lib/contracts
8. MOVE getMockContracts() to /scripts/seed-data.ts
9. UPDATE /scripts/seed-mongo.ts import
```

### Phase 3: Refactoring (OPTIONAL) 🟢
```bash
10. EXTRACT /app/contracts/[id]/utils.ts helpers
11. Make Slack/SMS/Signal functions private in notify-delivery.ts
```

---

## ESTIMATED IMPACT

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Duplicate Code** | 7 functions | 0 functions | **100%** |
| **Dead Code Lines** | ~270 lines | 0 lines | **270 lines** |
| **Unused Exports** | 5 functions | 0 functions | **100%** |
| **File Complexity** | page.tsx 4732 lines | ~4600 lines | **3%** |

---

## FILES TO DELETE COMPLETELY
1. ❌ `/lib/exchange-rai.ts` - Deprecated stub, throws error
2. ❌ `/lib/invoices.ts` - Pure re-export shim

## FILES TO CREATE
1. ✅ `/lib/utils/html.ts` - Consolidated HTML utilities
2. ✅ `/lib/utils/date.ts` - Consolidated date utilities
3. ✅ `/scripts/seed-data.ts` - Mock data extraction

---

## VERIFICATION COMMANDS

After cleanup, run:
```bash
# Check for broken imports
npm run build

# Search for any remaining duplicates
grep -r "function escapeHtml" app/ lib/
grep -r "function normalizeIsoDate" app/ lib/

# Verify no orphaned imports
grep -r "exchange-rai" app/ lib/
grep -r "from.*invoices" app/
```

---

## RISK ASSESSMENT

- **Breaking Changes:** LOW (only consolidating identical functions)
- **Test Impact:** NONE (no logic changes)
- **Deploy Risk:** MINIMAL (one build verification)

**RECOMMENDATION:** Execute Phase 1 immediately. This is technical debt that MUST be paid.