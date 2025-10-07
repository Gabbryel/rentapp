# Invoice Month Mode Enhancement

This document outlines the new invoice month mode functionality that allows contracts to specify whether monthly invoices are billed for the current month or in advance for the next month.

## Features Implemented

### A) Visual Badge for "În Avans" Contracts

Monthly contracts with `invoiceMonthMode: "next"` now display a blue "În avans" badge in:
- Contract listing page (`/contracts`)
- Home page invoice list (`/`)

**Implementation:**
- Badge appears next to contract status (Active/Expired)
- Only shows for monthly contracts with advance billing
- Uses blue color scheme to differentiate from status badges

### B) Fixed Annual Prognosis Logic

The annual prognosis calculation now correctly handles "next" mode billing:
- **Current mode**: All active months contribute to annual prognosis
- **Next mode**: Excludes months where the following month is not covered by the contract

**Edge Case Handling:**
- December billing in "next" mode only counts if contract extends into January of the next year
- Contracts ending mid-year exclude the final month's billing in "next" mode
- Year boundary transitions are handled correctly

### C) Migration Script

Created `scripts/migrate-invoice-month-mode.ts` to set existing contracts to "current" mode explicitly.

**Usage:**
```bash
# Preview what will be changed
npx tsx scripts/migrate-invoice-month-mode.ts --dry-run

# Execute the migration
npx tsx scripts/migrate-invoice-month-mode.ts --force
```

**Features:**
- Supports both MongoDB and local JSON storage
- Dry-run mode for safety
- Detailed logging of changes
- Audit trail logging
- Error handling and rollback safety

### D) Comprehensive Test Suite

Created tests covering edge cases and business logic:

**Test Categories:**
- Current mode behavior validation
- Next mode behavior with contract boundaries
- End-of-year edge cases (Dec → Jan transitions)
- Multi-year contract scenarios
- Error conditions and validation
- Migration script validation

**Run Tests:**
```bash
npx tsx __tests__/invoice-month-mode-runner.ts
```

## Schema Changes

The `Contract` schema now includes:

```typescript
invoiceMonthMode: z.enum(["current", "next"]).default("current")
```

- **"current"**: Invoice reflects the current active month (default behavior)
- **"next"**: Invoice is issued in advance for the following month

## UI Changes

### Contract Forms
Both create and edit forms now include the "Luna facturată" dropdown:
- "Luna curentă" (current month)
- "Luna următoare (în avans)" (next month in advance)

### Statistics API
The `/api/stats` route now correctly calculates:
- Monthly prognosis respecting invoice month mode
- Annual prognosis excluding invalid billing periods in "next" mode

## Business Logic

### Current Mode (default)
- Monthly invoice on day X covers the current month
- All active months contribute to annual prognosis
- Standard billing cycle

### Next Mode (advance billing)
- Monthly invoice on day X covers the following month
- Only months where the following month is within contract bounds contribute to annual prognosis
- Useful for advance payment requirements

## Examples

### Scenario 1: Contract ending December 31st
- **Current mode**: December invoice covers December (included in annual)
- **Next mode**: December invoice would cover January of next year (excluded from annual if contract ends Dec 31)

### Scenario 2: Contract ending June 30th
- **Current mode**: June invoice covers June (included)
- **Next mode**: June invoice would cover July (excluded since contract ends June 30)

### Scenario 3: Multi-year contract
- **Current mode**: All 12 months included in annual prognosis
- **Next mode**: All 12 months included (assuming contract continues into next year)

## Migration Considerations

1. **Existing Data**: All existing contracts default to "current" mode
2. **Backward Compatibility**: Undefined `invoiceMonthMode` is treated as "current"
3. **Data Integrity**: Migration script validates all changes before applying
4. **Audit Trail**: All changes are logged for compliance

## Testing

The implementation includes comprehensive tests for:

- ✅ Basic current/next mode functionality
- ✅ Year boundary edge cases (Dec → Jan)
- ✅ Contract expiration scenarios
- ✅ Multi-year contract handling
- ✅ Error conditions and data validation
- ✅ Migration script correctness

## API Impact

### `/api/stats` Route
- Enhanced monthly prognosis calculation
- Improved annual prognosis accuracy
- Maintains backward compatibility

### Contract CRUD Operations
- Create/edit actions now handle `invoiceMonthMode`
- Validation ensures proper enum values
- Default value assignment for new contracts

## Performance Considerations

- Minimal impact on existing queries
- Additional logic only runs for monthly contracts
- Efficient date calculations with proper caching
- No breaking changes to existing APIs

## Future Enhancements

Potential improvements for future versions:

1. **Rent History UI**: Display historical rent changes
2. **Advanced Filtering**: Filter contracts by billing mode
3. **Reporting**: Separate reports for current vs advance billing
4. **Bulk Operations**: Mass update billing modes
5. **Calendar Integration**: Visual calendar showing billing cycles

## Troubleshooting

### Common Issues

1. **Missing Badge**: Ensure contract has `rentType: "monthly"` and `invoiceMonthMode: "next"`
2. **Incorrect Stats**: Run migration script to ensure all contracts have explicit `invoiceMonthMode`
3. **Test Failures**: Verify date calculations account for timezone differences

### Validation

To verify the implementation is working correctly:

1. Run the test suite: `npx tsx __tests__/invoice-month-mode-runner.ts`
2. Check contract listing shows badges appropriately
3. Verify stats calculations with known test data
4. Run migration in dry-run mode to identify data inconsistencies