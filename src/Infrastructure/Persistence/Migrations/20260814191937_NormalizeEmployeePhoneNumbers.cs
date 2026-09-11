using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathilensERP.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The employee half of <see cref="NormalizeCustomerPhoneNumbers"/> — same rule, same table
    /// shape, same reason: a phone number is a phone number whoever it belongs to, and employees
    /// carry a unique phone index of their own.
    ///
    /// <para>Identically conservative. A number already held by another live employee, one claimed
    /// by two rows at once, or anything that isn't a recognizable Indian mobile number is left
    /// exactly as it is — <c>IX_Employees_PhoneNumber</c> is unique over live rows, and a migration
    /// that violates it fails on startup and takes the API down with it.</para>
    ///
    /// <para>Re-running changes nothing.</para>
    /// </summary>
    /// <inheritdoc />
    public partial class NormalizeEmployeePhoneNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Mirrors Shared/Contact/IndianPhoneNumber.cs.
            migrationBuilder.Sql("""
                WITH cleaned AS (
                    SELECT "Id",
                           "PhoneNumber" AS current_value,
                           regexp_replace("PhoneNumber", '[[:space:]\-()]', '', 'g') AS compact
                    FROM "Employees"
                    WHERE "IsDeleted" = false
                ),
                normalized AS (
                    SELECT "Id",
                           current_value,
                           CASE
                               WHEN compact !~ '^\+?[0-9]+$' THEN NULL
                               WHEN regexp_replace(compact, '^\+', '') ~ '^[0-9]{10}$'
                                   THEN '+91' || regexp_replace(compact, '^\+', '')
                               WHEN regexp_replace(compact, '^\+', '') ~ '^91[0-9]{10}$'
                                   THEN '+' || regexp_replace(compact, '^\+', '')
                               WHEN regexp_replace(compact, '^\+', '') ~ '^0[0-9]{10}$'
                                   THEN '+91' || substring(regexp_replace(compact, '^\+', '') from 2)
                               ELSE NULL
                           END AS canonical
                    FROM cleaned
                )
                UPDATE "Employees" e
                SET "PhoneNumber" = n.canonical
                FROM normalized n
                WHERE e."Id" = n."Id"
                  AND n.canonical IS NOT NULL
                  AND n.canonical <> n.current_value
                  AND NOT EXISTS (
                      SELECT 1 FROM "Employees" other
                      WHERE other."IsDeleted" = false
                        AND other."Id" <> e."Id"
                        AND other."PhoneNumber" = n.canonical)
                  AND NOT EXISTS (
                      SELECT 1 FROM normalized dup
                      WHERE dup."Id" <> n."Id"
                        AND dup.canonical = n.canonical);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Deliberately empty, as for customers: the shapes these were typed in were never
            // recorded, so there is nothing to put back.
        }
    }
}
