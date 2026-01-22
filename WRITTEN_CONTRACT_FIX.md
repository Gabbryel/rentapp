# Written Contract Form - Fix for Persistent Changes Issue

## Problem Description
Changes made to a written contract after reopening the form were not persisting. When a user would:
1. Open an existing written contract
2. Change the owner (or any other field)
3. Save the form
4. The page would reload, but the changes would be **reverted to the old values**

## Root Cause Analysis

The issue was a **race condition** between sessionStorage auto-save and page reload:

### The Problematic Flow:
```
1. User opens form with writtenContractId=xyz
   → Server returns fresh data as initialDocument
   → Component initializes state from initialDocument
   
2. Component mounts, draft-loading effect runs
   → Checks sessionStorage for "written-contract-draft-xyz"
   → No draft found (first visit)
   → Proceeds with initialDocument data ✓

3. User changes owner dropdown
   → State updates with new owner
   → Auto-save effect runs
   → Saves to sessionStorage["written-contract-draft-xyz"] ✓

4. User clicks save
   → Form action succeeds
   → Clears sessionStorage["written-contract-draft-xyz"]
   → Redirects with window.location.href to same URL
   
5. Page RELOADS (full page refresh)
   → Server returns fresh data with new owner in initialDocument ✓
   → Component REMOUNTS
   → State initializes from initialDocument (new owner) ✓
   
6. BUT THEN... draft-loading effect runs!
   → The auto-save effect ALSO runs (before draft-loading)
   → Auto-save saves the current state (with new owner) to sessionStorage
   → Draft-loading effect reads from sessionStorage
   → Loads the just-saved state and overwrites the fresh server state
   
   THE PROBLEM: The timing of useEffect execution causes the 
   auto-save to run BEFORE we can prevent draft loading!
```

### Why This Happened:
- Both auto-save and draft-loading are in `useEffect` hooks
- After page reload, React batches effect execution
- The auto-save effect runs and saves current state to sessionStorage
- The draft-loading effect then reads that sessionStorage
- This creates a circular dependency where stale data persists

## The Solution

Use a **temporary flag in sessionStorage** to signal "we just saved, skip draft loading on next mount":

### Key Implementation:

```typescript
// 1. Add a "just-saved" key alongside the draft key
const justSavedKey = useMemo(() => {
  return initialDocument?.id
    ? `written-contract-just-saved-${initialDocument.id}`
    : null;
}, [initialDocument?.id]);

// 2. In draft-loading effect, check the flag FIRST
useEffect(() => {
  if (typeof window === "undefined") return;
  
  // If we just saved, skip draft loading this ONE time
  if (justSavedKey) {
    const wasSaved = window.sessionStorage.getItem(justSavedKey);
    if (wasSaved) {
      window.sessionStorage.removeItem(justSavedKey); // Clear immediately
      setLoadedDraft(true);
      return; // Exit early, don't load draft
    }
  }
  
  // Normal draft loading continues...
}, [storageKey, justSavedKey]);

// 3. When saving, set the flag BEFORE redirect
useEffect(() => {
  if (!formState?.ok) return;
  
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(draftKey); // Clear draft
      // Set the flag so next mount skips draft loading
      window.sessionStorage.setItem(justSavedKey, "true");
    } catch (error) {
      console.warn("Could not clear draft", error);
    }
  }
  
  if (formState.redirectTo) {
    window.location.href = formState.redirectTo; // Full reload
  }
}, [formState]);
```

### The Fixed Flow:
```
1. User makes changes
   → State updates
   → Auto-save saves to "written-contract-draft-xyz" ✓

2. User clicks save
   → Form action succeeds
   → Clears "written-contract-draft-xyz"
   → Sets "written-contract-just-saved-xyz" = "true" ← NEW!
   → Redirects with window.location.href
   
3. Page reloads
   → Server returns fresh data with saved changes ✓
   → Component mounts
   → Draft-loading effect runs FIRST:
     • Checks "written-contract-just-saved-xyz": FOUND!
     • Removes the flag immediately
     • Returns early WITHOUT loading draft ✓
   → Auto-save effect runs:
     • Saves current state to sessionStorage
     • But draft-loading already finished, so no conflict ✓
   
4. State reflects fresh server data ✓

5. Next time user opens (without save)
   → Draft-loading checks "written-contract-just-saved-xyz": NOT FOUND
   → Proceeds to load draft normally
   → Draft functionality works as expected ✓
```

## Benefits of This Approach

1. **Minimal Changes**: Only adds 3 small modifications to existing code
2. **Preserves Draft Functionality**: Normal draft auto-save/restore still works
3. **No Router Changes**: Uses existing `window.location.href` redirect
4. **Survives Page Reload**: Flag persists in sessionStorage across reloads
5. **Self-Cleaning**: Flag is removed immediately after first check
6. **No Side Effects**: Doesn't affect other forms or components

## Testing

### Automated Test:
```bash
node __tests__/written-contract-storage-test.js
```

### Manual Test Steps:
1. Open: http://localhost:3000/contracts/written-contract?writtenContractId=a66920de-7a23-4b34-9b21-2815802a42e7
2. Change the owner dropdown to a different owner
3. Click "Salvează documentul" (Save)
4. Wait for page to reload
5. **Verify**: Owner dropdown shows the NEW owner (not reverted) ✓
6. Make another change without saving
7. Refresh page (F5)
8. **Verify**: The unsaved change is restored from draft ✓

### Browser DevTools Verification:
Open Console and watch sessionStorage:
```javascript
// After making a change (not saved)
sessionStorage.getItem('written-contract-draft-{id}') // Has draft

// After clicking save
sessionStorage.getItem('written-contract-just-saved-{id}') // "true"
sessionStorage.getItem('written-contract-draft-{id}') // null (cleared)

// After page reloads
sessionStorage.getItem('written-contract-just-saved-{id}') // null (cleared)
sessionStorage.getItem('written-contract-draft-{id}') // null or new draft
```

## Files Modified

- `app/contracts/written-contract/written-contract-form.tsx` - Added just-saved flag logic

## Files Added (for documentation/testing)
- `__tests__/written-contract-form-flow.md` - Flow documentation
- `__tests__/written-contract-storage-test.js` - Automated test

## Conclusion

The fix elegantly solves the race condition by using a temporary flag that:
- Persists across page reloads (sessionStorage)
- Gets checked before draft loading
- Self-cleans immediately after use
- Doesn't interfere with normal draft functionality

This ensures that changes made to the form are properly persisted after save, while maintaining the auto-save draft feature for unsaved changes.
