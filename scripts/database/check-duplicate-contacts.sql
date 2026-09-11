-- Pre-deployment check for the AddEmployeeCodeAndUniqueContactIndexes migration.
--
-- That migration makes customer phone numbers, employee phone numbers and employee codes unique.
-- Creating a unique index over data that already violates it fails, and because the API applies
-- migrations on startup, that failure stops the app from starting. Run this first.
--
--   psql "<your connection string>" -f scripts/database/check-duplicate-contacts.sql
--
-- Every section should return zero rows. Anything returned has to be merged or corrected before
-- deploying — which of two records is the real customer is a shop decision, not one a migration
-- should make on its own. Soft-deleted rows are excluded throughout, because the indexes are
-- filtered the same way: a deleted record does not reserve a number.

\echo '== Customers sharing a phone number =='
SELECT
    c."PhoneNumber",
    COUNT(*)                                    AS duplicate_count,
    STRING_AGG(c."FullName", ' | ' ORDER BY c."CreatedAtUtc") AS customers,
    STRING_AGG(c."Id"::text, ' | ' ORDER BY c."CreatedAtUtc")  AS ids
FROM "Customers" c
WHERE c."IsDeleted" = false
GROUP BY c."PhoneNumber"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, c."PhoneNumber";

\echo '== Employees sharing a phone number =='
-- Employees with no phone number recorded are not compared: "not recorded" is a state several
-- staff may equally be in, and the unique index excludes NULL for that reason.
SELECT
    e."PhoneNumber",
    COUNT(*)                                    AS duplicate_count,
    STRING_AGG(e."FullName", ' | ' ORDER BY e."CreatedAtUtc") AS employees,
    STRING_AGG(e."Id"::text, ' | ' ORDER BY e."CreatedAtUtc")  AS ids
FROM "Employees" e
WHERE e."IsDeleted" = false
  AND e."PhoneNumber" IS NOT NULL
GROUP BY e."PhoneNumber"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, e."PhoneNumber";

\echo '== Customer phone numbers that differ only by formatting =='
-- Not blocking: the unique index compares numbers exactly as entered, so these will migrate
-- cleanly. They are almost certainly the same person twice, though, so they are worth a look
-- while you are in here.
SELECT
    REGEXP_REPLACE(c."PhoneNumber", '[^0-9]', '', 'g')       AS digits_only,
    COUNT(*)                                                 AS duplicate_count,
    STRING_AGG(c."PhoneNumber", ' | ' ORDER BY c."CreatedAtUtc") AS as_entered,
    STRING_AGG(c."FullName", ' | ' ORDER BY c."CreatedAtUtc")    AS customers
FROM "Customers" c
WHERE c."IsDeleted" = false
GROUP BY REGEXP_REPLACE(c."PhoneNumber", '[^0-9]', '', 'g')
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Employee codes need no check: the column does not exist until this migration adds it, and the
-- migration numbers existing staff EMP-001, EMP-002... in the order they were added, which is
-- unique by construction. Rename any of them afterwards from the Employees screen.
