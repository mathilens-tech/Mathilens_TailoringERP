using Microsoft.AspNetCore.Identity;
using Npgsql;

namespace MathilensERP.Tools.ResetPassword;

/// <summary>
/// Sets a user's password directly in the database, for the one case the application itself
/// cannot cover: nobody can sign in as an Owner any more, so there is no authenticated caller
/// left to perform the reset through the API.
///
/// This is deliberately a separate console project rather than anything reachable over HTTP.
/// deploy-api.yml publishes src/Api only, so nothing here ships to Azure — running it requires
/// the database connection string in hand, which is the intended bar.
///
/// The password hash is produced by ASP.NET Core Identity's own <see cref="PasswordHasher{TUser}"/>
/// at the version the API references, so the result is byte-for-byte what the API would have
/// written itself. Computing the hash by hand in SQL is not possible: it is a PBKDF2 blob whose
/// format and iteration count are Identity's to decide.
/// </summary>
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        try
        {
            var options = CommandLineOptions.Parse(args);

            if (options.ShowHelp)
            {
                PrintUsage();
                return 0;
            }

            await using var connection = new NpgsqlConnection(options.ConnectionString);
            await connection.OpenAsync();

            if (options.ListOnly)
            {
                await ListUsersAsync(connection);
                return 0;
            }

            return await ResetPasswordAsync(connection, options);
        }
        catch (CommandLineException ex)
        {
            Console.Error.WriteLine($"error: {ex.Message}");
            Console.Error.WriteLine();
            PrintUsage();
            return 2;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"error: {ex.Message}");
            return 1;
        }
    }

    private static async Task ListUsersAsync(NpgsqlConnection connection)
    {
        const string sql = """
            SELECT u."Email", u."IsDeleted",
                   COALESCE(string_agg(r."Name", ', ' ORDER BY r."Name"), '(no role)') AS roles
            FROM "Users" u
            LEFT JOIN "UserRoles" ur ON ur."UserId" = u."Id"
            LEFT JOIN "Roles" r ON r."Id" = ur."RoleId"
            GROUP BY u."Id", u."Email", u."IsDeleted"
            ORDER BY u."Email"
            """;

        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var found = false;
        while (await reader.ReadAsync())
        {
            found = true;
            var email = reader.IsDBNull(0) ? "(no email)" : reader.GetString(0);
            var deleted = reader.GetBoolean(1) ? "  [deleted]" : string.Empty;
            Console.WriteLine($"{email,-40}  {reader.GetString(2)}{deleted}");
        }

        if (!found)
        {
            Console.WriteLine("This database has no user accounts.");
        }
    }

    private static async Task<int> ResetPasswordAsync(NpgsqlConnection connection, CommandLineOptions options)
    {
        var user = await FindUserAsync(connection, options.Email!);
        if (user is null)
        {
            Console.Error.WriteLine($"error: no account with email '{options.Email}'. Run with --list to see the accounts that exist.");
            return 1;
        }

        var password = options.Password ?? ReadPasswordFromConsole();
        var policyFailure = DescribePolicyViolation(password);
        if (policyFailure is not null)
        {
            Console.Error.WriteLine($"error: {policyFailure}");
            return 2;
        }

        Console.WriteLine($"Account:  {user.Email}");
        Console.WriteLine($"Roles:    {user.Roles}");
        if (user.IsDeleted)
        {
            Console.WriteLine("Warning:  this account is soft-deleted and will still be refused at login.");
        }

        if (!options.SkipConfirmation && !Confirm())
        {
            Console.WriteLine("Cancelled. Nothing was changed.");
            return 130;
        }

        // The user object is not consulted by the default hasher, so any instance will do.
        var passwordHash = new PasswordHasher<HashTarget>().HashPassword(new HashTarget(), password);
        var now = DateTime.UtcNow;

        await using var transaction = await connection.BeginTransactionAsync();

        // SecurityStamp is rotated because that is what UserManager.ResetPasswordAsync does: it
        // marks every previously issued credential as belonging to a superseded state.
        const string updateUserSql = """
            UPDATE "Users"
            SET "PasswordHash" = @hash,
                "SecurityStamp" = @securityStamp,
                "ConcurrencyStamp" = @concurrencyStamp,
                "AccessFailedCount" = 0,
                "LockoutEnd" = NULL,
                "LastModifiedAtUtc" = @now,
                "LastModifiedBy" = "Id"
            WHERE "Id" = @id
            """;

        await using (var command = new NpgsqlCommand(updateUserSql, connection, transaction))
        {
            command.Parameters.AddWithValue("hash", passwordHash);
            command.Parameters.AddWithValue("securityStamp", Guid.NewGuid().ToString("N").ToUpperInvariant());
            command.Parameters.AddWithValue("concurrencyStamp", Guid.NewGuid().ToString());
            command.Parameters.AddWithValue("now", now);
            command.Parameters.AddWithValue("id", user.Id);

            await command.ExecuteNonQueryAsync();
        }

        // A refresh token outlives the password that created it — RefreshTokenAsync only checks
        // the stored hash, never the credential. Anyone holding one could keep minting access
        // tokens for this account for up to RefreshTokenExpiryDays after the reset, which would
        // defeat the point of resetting it at all.
        const string revokeTokensSql = """
            UPDATE "RefreshTokens"
            SET "RevokedAtUtc" = @now,
                "LastModifiedAtUtc" = @now,
                "LastModifiedBy" = "UserId"
            WHERE "UserId" = @id AND "RevokedAtUtc" IS NULL
            """;

        int revokedCount;
        await using (var command = new NpgsqlCommand(revokeTokensSql, connection, transaction))
        {
            command.Parameters.AddWithValue("now", now);
            command.Parameters.AddWithValue("id", user.Id);

            revokedCount = await command.ExecuteNonQueryAsync();
        }

        await transaction.CommitAsync();

        Console.WriteLine();
        Console.WriteLine($"Password reset for {user.Email}.");
        Console.WriteLine($"Sessions revoked: {revokedCount} refresh token(s).");
        Console.WriteLine("Any access token already issued stays valid until it expires (15 minutes by default).");

        return 0;
    }

    private static async Task<UserRow?> FindUserAsync(NpgsqlConnection connection, string email)
    {
        // Identity looks users up by NormalizedEmail, and its default normalizer is
        // ToUpperInvariant — matching on that is what makes the lookup case-insensitive here too.
        const string sql = """
            SELECT u."Id", u."Email", u."IsDeleted",
                   COALESCE(string_agg(r."Name", ', ' ORDER BY r."Name"), '(no role)') AS roles
            FROM "Users" u
            LEFT JOIN "UserRoles" ur ON ur."UserId" = u."Id"
            LEFT JOIN "Roles" r ON r."Id" = ur."RoleId"
            WHERE u."NormalizedEmail" = @normalizedEmail
            GROUP BY u."Id", u."Email", u."IsDeleted"
            """;

        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("normalizedEmail", email.ToUpperInvariant());

        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }

        return new UserRow(
            reader.GetGuid(0),
            reader.IsDBNull(1) ? email : reader.GetString(1),
            reader.GetBoolean(2),
            reader.GetString(3));
    }

    /// <summary>
    /// Mirrors the policy configured in Infrastructure's DependencyInjection: 8 characters,
    /// non-alphanumerics not required, everything else at Identity's defaults. Checked here so a
    /// password set out-of-band is never one the application itself would have rejected.
    /// </summary>
    private static string? DescribePolicyViolation(string password)
    {
        if (password.Length < 8)
        {
            return "the password policy requires at least 8 characters.";
        }

        if (!password.Any(char.IsDigit))
        {
            return "the password policy requires at least one digit.";
        }

        if (!password.Any(char.IsLower))
        {
            return "the password policy requires at least one lowercase letter.";
        }

        if (!password.Any(char.IsUpper))
        {
            return "the password policy requires at least one uppercase letter.";
        }

        return null;
    }

    private static string ReadPasswordFromConsole()
    {
        Console.Write("New password: ");

        var password = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);

            if (key.Key == ConsoleKey.Enter)
            {
                Console.WriteLine();
                break;
            }

            if (key.Key == ConsoleKey.Backspace)
            {
                if (password.Length > 0)
                {
                    password.Length--;
                }

                continue;
            }

            if (!char.IsControl(key.KeyChar))
            {
                password.Append(key.KeyChar);
            }
        }

        return password.ToString();
    }

    private static bool Confirm()
    {
        Console.Write("Reset this account's password? [y/N] ");
        var answer = Console.ReadLine();
        return string.Equals(answer?.Trim(), "y", StringComparison.OrdinalIgnoreCase);
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            Resets a user's password directly in the database.

            Usage:
              dotnet run --project tools/ResetPassword -- --list
              dotnet run --project tools/ResetPassword -- --email <address> [--password <new>] [--yes]

            Options:
              --connection <string>  Npgsql connection string. Defaults to the
                                     MATHILENS_CONNECTION environment variable.
              --list                 List every account and its role, then exit.
              --email <address>      The account to reset.
              --password <new>       The new password. Prompted for (without echo) if omitted,
                                     which keeps it out of shell history.
              --yes                  Skip the confirmation prompt.
              --help                 Show this message.
            """);
    }

    private sealed record UserRow(Guid Id, string Email, bool IsDeleted, string Roles);

    /// <summary>The default password hasher ignores the user instance; this satisfies its generic constraint.</summary>
    private sealed class HashTarget;
}
