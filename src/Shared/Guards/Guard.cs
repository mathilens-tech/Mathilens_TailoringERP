namespace MathilensERP.Shared.Guards;

/// <summary>
/// Guard clauses for enforcing Domain invariants at construction time
/// (01_ARCHITECTURE.md § 9.3 — entities enforce their own invariants).
/// These throw, since violating a constructor/factory precondition is a programming
/// error, not an expected business outcome (00_MASTER_SPEC.md § 7.13).
/// </summary>
public static class Guard
{
    public static T AgainstNull<T>(T? value, string paramName)
        where T : class =>
        value ?? throw new ArgumentNullException(paramName);

    public static string AgainstNullOrWhiteSpace(string? value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null, empty, or whitespace.", paramName);
        }

        return value;
    }

    public static Guid AgainstEmpty(Guid value, string paramName)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Value cannot be an empty GUID.", paramName);
        }

        return value;
    }

    public static int AgainstNegative(int value, string paramName)
    {
        if (value < 0)
        {
            throw new ArgumentOutOfRangeException(paramName, value, "Value cannot be negative.");
        }

        return value;
    }

    public static decimal AgainstNegativeOrZero(decimal value, string paramName)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(paramName, value, "Value must be greater than zero.");
        }

        return value;
    }

    public static int AgainstOutOfRange(int value, int min, int max, string paramName)
    {
        if (value < min || value > max)
        {
            throw new ArgumentOutOfRangeException(paramName, value, $"Value must be between {min} and {max}.");
        }

        return value;
    }
}
